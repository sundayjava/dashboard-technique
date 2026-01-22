import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// Helper function to generate card number based on brand
function generateCardNumber(brand: string): string {
  let prefix = '';
  let length = 16;
  
  switch (brand) {
    case 'VISA':
      prefix = '4';
      break;
    case 'MASTERCARD':
      prefix = '5' + Math.floor(Math.random() * 5 + 1); // 51-55
      break;
    case 'AMEX':
      prefix = '3' + (Math.random() > 0.5 ? '4' : '7'); // 34 or 37
      length = 15;
      break;
    default:
      prefix = '4'; // Default to Visa
  }
  
  // Generate remaining digits
  let cardNumber = prefix;
  for (let i = prefix.length; i < length; i++) {
    cardNumber += Math.floor(Math.random() * 10);
  }
  
  return cardNumber;
}

// Helper function to generate CVV
function generateCVV(brand: string): string {
  const length = brand === 'AMEX' ? 4 : 3;
  let cvv = '';
  for (let i = 0; i < length; i++) {
    cvv += Math.floor(Math.random() * 10);
  }
  return cvv;
}

// Helper function to generate expiry date (5 years from now)
function generateExpiryDate(): { month: number; year: number } {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);
  
  return {
    month: expiryDate.getMonth() + 1,
    year: expiryDate.getFullYear()
  };
}

// Helper function to determine card brand based on card type
function getCardBrand(cardType: string): string {
  // For VIRTUAL cards, we can randomly assign or use a default
  // In production, this might be based on user preference or bank agreements
  const brands = ['VISA', 'MASTERCARD'];
  return brands[Math.floor(Math.random() * brands.length)];
}

// GET - Get single card application
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const application = await prisma.cardApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Card application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ application });
  } catch (error) {
    console.error('Error fetching card application:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card application' },
      { status: 500 }
    );
  }
}

// PATCH - Update card application (approve/reject/update)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, adminNotes, approvedBy } = body;

    const application = await prisma.cardApplication.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Card application not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      
      if (status === 'APPROVED' || status === 'ISSUED') {
        updateData.approvedAt = new Date();
        if (approvedBy) updateData.approvedBy = approvedBy;
        
        // Generate real card details when approving
        const cardBrand = getCardBrand(application.cardType);
        const cardNumber = generateCardNumber(cardBrand);
        const cvv = generateCVV(cardBrand);
        const expiry = generateExpiryDate();
        
        updateData.cardNumber = cardNumber;
        updateData.cardBrand = cardBrand;
        updateData.cvv = cvv;
        updateData.expiryMonth = expiry.month;
        updateData.expiryYear = expiry.year;
        updateData.cardHolderName = application.user.name?.toUpperCase() || 'CARD HOLDER';
        updateData.issuedAt = new Date();
        updateData.status = 'ISSUED'; // Set to ISSUED once card details are generated
        
        console.log('✅ Generated card details:', {
          cardNumber,
          cardBrand,
          cvv,
          expiryMonth: expiry.month,
          expiryYear: expiry.year,
          cardHolderName: updateData.cardHolderName
        });
      } else if (status === 'REJECTED') {
        updateData.rejectedAt = new Date();
        updateData.status = status;
      } else {
        updateData.status = status;
      }
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    // Update the application
    const updatedApplication = await prisma.cardApplication.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        userId: true,
        phoneNumber: true,
        accountNumber: true,
        cardType: true,
        status: true,
        adminNotes: true,
        approvedBy: true,
        approvedAt: true,
        rejectedAt: true,
        issuedAt: true,
        cardNumber: true,
        cardBrand: true,
        cvv: true,
        expiryMonth: true,
        expiryYear: true,
        cardHolderName: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log('✅ Card application updated in database:', {
      id: updatedApplication.id,
      status: updatedApplication.status,
      hasCardNumber: !!updatedApplication.cardNumber,
      cardBrand: updatedApplication.cardBrand,
    });

    // Create notification for user
    if (status) {
      let notificationMessage = '';
      let notificationType: 'CARD' | 'SYSTEM' = 'CARD';

      if (status === 'APPROVED' || status === 'ISSUED') {
        notificationMessage = `Your ${application.cardType} card application has been approved! Your card is now available in your dashboard.`;
        
        // Send email notification to user
        if (application.user.email) {
          try {
            await sendEmail({
              to: application.user.email,
              subject: '🎉 Your Card Application Has Been Approved!',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">Card Approved!</h1>
                  </div>
                  
                  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      Dear ${application.user.name || 'Valued Customer'},
                    </p>
                    
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      Great news! Your <strong>${application.cardType}</strong> card application has been approved.
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                      <h3 style="margin-top: 0; color: #667eea;">Card Details</h3>
                      <p style="margin: 5px 0;"><strong>Card Type:</strong> ${application.cardType}</p>
                      <p style="margin: 5px 0;"><strong>Card Brand:</strong> ${updateData.cardBrand || 'Virtual Card'}</p>
                      <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
                    </div>
                    
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      Your card is now active and ready to use. You can view your complete card details in your dashboard.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
                         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        View My Card
                      </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      If you have any questions, please don't hesitate to contact our support team.
                    </p>
                  </div>
                </div>
              `,
            });
          } catch (emailError) {
            console.error('Failed to send card approval email:', emailError);
            // Don't fail the request if email fails
          }
        }
      } else if (status === 'REJECTED') {
        notificationMessage = `Your ${application.cardType} card application has been rejected. ${adminNotes || ''}`;
        
        // Send rejection email to user
        if (application.user.email) {
          try {
            await sendEmail({
              to: application.user.email,
              subject: 'Card Application Status Update',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: #ef4444; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">Application Update</h1>
                  </div>
                  
                  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      Dear ${application.user.name || 'Valued Customer'},
                    </p>
                    
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      We regret to inform you that your ${application.cardType} card application has been rejected.
                    </p>
                    
                    ${adminNotes ? `
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                      <h3 style="margin-top: 0; color: #ef4444;">Reason</h3>
                      <p style="margin: 5px 0;">${adminNotes}</p>
                    </div>
                    ` : ''}
                    
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                      If you have any questions or would like to discuss this decision, please contact our support team.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contact" 
                         style="background: #374151; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Contact Support
                      </a>
                    </div>
                  </div>
                </div>
              `,
            });
          } catch (emailError) {
            console.error('Failed to send card rejection email:', emailError);
          }
        }
      }

      if (notificationMessage) {
        await prisma.notification.create({
          data: {
            userId: application.userId,
            type: notificationType,
            title: 'Card Application Update',
            message: notificationMessage,
            link: '/dashboard/monetary/cards',
          },
        });
      }
    }

    return NextResponse.json({
      message: 'Card application updated successfully',
      application: updatedApplication,
    });
  } catch (error) {
    console.error('Error updating card application:', error);
    return NextResponse.json(
      { error: 'Failed to update card application' },
      { status: 500 }
    );
  }
}

// DELETE - Delete card application
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const application = await prisma.cardApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Card application not found' },
        { status: 404 }
      );
    }

    await prisma.cardApplication.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Card application deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting card application:', error);
    return NextResponse.json(
      { error: 'Failed to delete card application' },
      { status: 500 }
    );
  }
}
