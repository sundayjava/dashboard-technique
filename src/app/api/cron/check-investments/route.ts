import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInvestmentMaturityNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external cron service)
// Call it every hour or day: GET /api/cron/check-investments
// You can protect it with a secret token in production

export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication token check for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log('🔍 Checking for matured investments at:', now.toISOString());

    // Find all ACTIVE investments that have reached or passed their endDate
    const maturedInvestments = await prisma.investment.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: now, // Less than or equal to current time
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plan: {
          select: {
            id: true,
            planName: true,
            profitPercentage: true,
            duration: true,
            compoundingCycles: true,
          },
        },
      },
    });

    console.log(`📊 Found ${maturedInvestments.length} matured investments`);

    // Auto-compound investments that have more cycles
    let autoCompoundedCount = 0;
    let needsAdminCount = 0;
    const investmentsNeedingAdmin = [];

    for (const investment of maturedInvestments) {
      const isCompounding = investment.plan.compoundingCycles > 0;
      const hasMoreCycles = investment.currentCycle < investment.totalCycles;

      if (isCompounding && hasMoreCycles && !investment.isStopped) {
        // AUTO-COMPOUND: Calculate profit and reinvest
        const profitEarned = investment.amount * (investment.plan.profitPercentage / 100);
        const newPrincipal = investment.amount + profitEarned;
        const newStartDate = new Date();
        const newEndDate = new Date(newStartDate.getTime() + (investment.plan.duration * 24 * 60 * 60 * 1000));

        await prisma.investment.update({
          where: { id: investment.id },
          data: {
            amount: newPrincipal, // Grow principal
            currentCycle: investment.currentCycle + 1,
            startDate: newStartDate,
            endDate: newEndDate,
            profitEarned: 0, // Reset for new cycle
          },
        });

        // Notify user about auto-compounding
        await prisma.notification.create({
          data: {
            userId: investment.userId,
            type: 'INVESTMENT',
            title: 'Investment Auto-Compounded',
            message: `Your ${investment.plan.planName} investment completed cycle ${investment.currentCycle} of ${investment.totalCycles}. Profit: $${profitEarned.toFixed(2)}. New principal: $${newPrincipal.toFixed(2)}. Automatically starting cycle ${investment.currentCycle + 1}.`,
            link: '/investment',
          },
        });

        console.log(`✅ Auto-compounded investment #${investment.id} to cycle ${investment.currentCycle + 1}/${investment.totalCycles}`);
        autoCompoundedCount++;
      } else {
        // NEEDS ADMIN: Final cycle or stopped - add to list for admin notification
        investmentsNeedingAdmin.push(investment);
        needsAdminCount++;
      }
    }

    console.log(`🔄 Auto-compounded: ${autoCompoundedCount}, Needs admin completion: ${needsAdminCount}`);

    if (investmentsNeedingAdmin.length === 0) {
      return NextResponse.json({
        success: true,
        message: autoCompoundedCount > 0 
          ? `Auto-compounded ${autoCompoundedCount} investments. No investments need admin completion.`
          : 'No matured investments found',
        autoCompoundedCount,
        needsAdminCount: 0,
      });
    }

    // Get all admin users for final completion notifications
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`👥 Found ${admins.length} admin users`);

    if (admins.length === 0) {
      console.error('❌ No admin users found in the database');
      return NextResponse.json({
        success: false,
        error: 'No admin users found',
        autoCompoundedCount,
        needsAdminCount,
      });
    }

    // Send email to admins about investments needing final completion
    const emailPromises = [];
    
    for (const investment of investmentsNeedingAdmin) {
      // Calculate expected profit
      const expectedProfit = investment.amount * (investment.plan.profitPercentage / 100);
      const totalReturn = investment.amount + expectedProfit;

      // Determine if it's a compounding investment
      const isCompounding = investment.plan.compoundingCycles > 1;
      const hasMoreCycles = investment.currentCycle < investment.totalCycles;

      for (const admin of admins) {
        const emailPromise = sendInvestmentMaturityNotification({
          adminEmail: admin.email,
          adminName: admin.name || 'Admin',
          investment: {
            id: investment.id,
            investorName: investment.user.name || 'Investor',
            investorEmail: investment.user.email,
            planName: investment.plan.planName,
            amount: investment.amount,
            expectedProfit,
            totalReturn,
            startDate: investment.startDate!,
            endDate: investment.endDate!,
            currentCycle: investment.currentCycle,
            totalCycles: investment.totalCycles,
            isCompounding,
            hasMoreCycles,
          },
        }).catch((error) => {
          console.error(`❌ Failed to send email to admin ${admin.email}:`, error);
          return { success: false, error: error.message };
        });
        
        emailPromises.push(emailPromise);
      }

      // Create a notification for each admin
      const notificationPromises = admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'INVESTMENT',
            title: 'Investment Maturity Alert',
            message: `Investment for ${investment.user.name} (${investment.plan.planName}) has matured. Amount: $${investment.amount.toLocaleString()}, Expected Profit: $${expectedProfit.toLocaleString()}. Please review and complete manually.`,
            link: '/admin/investments',
          },
        }).catch((error) => {
          console.error(`❌ Failed to create notification for admin ${admin.id}:`, error);
          return null;
        })
      );

      emailPromises.push(...notificationPromises);
    }

    // Wait for all emails and notifications to be sent
    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Sent ${successCount} notifications successfully`);
    if (failureCount > 0) {
      console.log(`⚠️ Failed to send ${failureCount} notifications`);
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${maturedInvestments.length} matured investments: ${autoCompoundedCount} auto-compounded, ${needsAdminCount} need admin completion`,
      totalMatured: maturedInvestments.length,
      autoCompoundedCount,
      needsAdminCount,
      adminsNotified: admins.length,
      emailsSent: successCount,
      emailsFailed: failureCount,
      investments: investmentsNeedingAdmin.map((inv) => ({
        id: inv.id,
        investor: inv.user.name,
        plan: inv.plan.planName,
        amount: inv.amount,
        endDate: inv.endDate,
        currentCycle: inv.currentCycle,
        totalCycles: inv.totalCycles,
      })),
    });

  } catch (error) {
    console.error('❌ Error in investment maturity check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check investments',
      },
      { status: 500 }
    );
  }
}
