import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateChainAccountNumber,
  generateSigningToken,
  hasReachedChainAccountLimit,
  generateMemorandumReference
} from '@/lib/chain-account-utils';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const {
      accountName: customAccountName,
      primaryPurpose,
      purposeDescription,
      numberOfParties,
      relationship,
      coSignatories,
      expectedMonthlyVolume,
      combinedCapitalLevel,
      intendedAssetHoldings,
      authorizationModel,
      thresholdAmount,
      thresholdCurrency,
    } = data;

    // Get user from session - in production, verify JWT token
    // TODO: Implement proper JWT verification
    // For now, assume userId is passed in the request body
    const { userId } = data;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!customAccountName || !primaryPurpose || !numberOfParties ||
        !relationship || !expectedMonthlyVolume || !combinedCapitalLevel ||
        !intendedAssetHoldings || !authorizationModel) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    // Validate account name length
    if (customAccountName.length < 3) {
      return NextResponse.json(
        { error: 'Account name must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Validate number of parties
    if (numberOfParties < 2 || numberOfParties > 4) {
      return NextResponse.json(
        { error: 'Number of parties must be between 2 and 4' },
        { status: 400 }
      );
    }

    // Validate co-signatories count
    const requiredCoSignatories = numberOfParties - 1;
    if (!coSignatories || coSignatories.length !== requiredCoSignatories) {
      return NextResponse.json(
        { error: `Exactly ${requiredCoSignatories} co-signatories are required` },
        { status: 400 }
      );
    }

    // Check if primary holder has reached limit
    const hasReachedLimit = await hasReachedChainAccountLimit(userId);
    if (hasReachedLimit) {
      return NextResponse.json(
        { error: 'You have reached the maximum of 3 Chain Accounts' },
        { status: 400 }
      );
    }

    // Get primary holder details
    const primaryHolder = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!primaryHolder) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify all co-signatories exist and haven't reached limit
    const coSignatoryUsers = await Promise.all(
      coSignatories.map(async (cs: any) => {
        const user = await prisma.user.findUnique({
          where: { id: cs.userId },
          select: { id: true, name: true, email: true }
        });

        if (!user) {
          throw new Error(`Co-signatory with ID ${cs.userId} not found`);
        }

        const hasLimit = await hasReachedChainAccountLimit(user.id);
        if (hasLimit) {
          throw new Error(`${user.name || user.email} has reached their maximum of 3 Chain Accounts`);
        }

        return user;
      })
    );

    // Check for duplicates
    const allUserIds = [userId, ...coSignatoryUsers.map(u => u.id)];
    const uniqueIds = new Set(allUserIds);
    if (allUserIds.length !== uniqueIds.size) {
      return NextResponse.json(
        { error: 'Duplicate members detected' },
        { status: 400 }
      );
    }

    // Generate account number
    const accountNumber = await generateChainAccountNumber();

    // Use custom account name provided by user
    const accountName = customAccountName;

    // Create Chain Account
    const chainAccount = await prisma.chainAccount.create({
      data: {
        accountNumber,
        accountName,
        primaryPurpose,
        purposeDescription,
        numberOfParties,
        relationship,
        expectedMonthlyVolume,
        combinedCapitalLevel,
        intendedAssetHoldings,
        authorizationModel,
        thresholdAmount: thresholdAmount ? parseFloat(thresholdAmount) : null,
        thresholdCurrency: thresholdCurrency || 'USD',
        status: 'PENDING',
        balance: 0,
        currency: 'USD',
        createdBy: userId,
      },
    });

    // Create primary holder member record
    const primarySigningToken = generateSigningToken();
    await prisma.chainAccountMember.create({
      data: {
        chainAccountId: chainAccount.id,
        userId: primaryHolder.id,
        role: 'PRIMARY_HOLDER',
        hasConfirmed: false,
        signingToken: primarySigningToken,
        signingTokenUsed: false,
      },
    });

    // Create co-signatory member records
    const coSignatoryTokens: Record<string, string> = {};
    for (const user of coSignatoryUsers) {
      const signingToken = generateSigningToken();
      coSignatoryTokens[user.id] = signingToken;
      
      await prisma.chainAccountMember.create({
        data: {
          chainAccountId: chainAccount.id,
          userId: user.id,
          role: 'CO_SIGNATORY',
          hasConfirmed: false,
          signingToken,
          signingTokenUsed: false,
        },
      });
    }

    // Generate memorandum
    const documentReference = generateMemorandumReference(accountNumber);
    const memorandumContent = generateMemorandumContent({
      accountNumber,
      accountName,
      documentReference,
      primaryHolder,
      coSignatories: coSignatoryUsers,
      formData: {
        primaryPurpose,
        purposeDescription,
        numberOfParties,
        relationship,
        expectedMonthlyVolume,
        combinedCapitalLevel,
        intendedAssetHoldings,
        authorizationModel,
        thresholdAmount,
        thresholdCurrency,
      },
    });

    await prisma.chainAccountMemorandum.create({
      data: {
        chainAccountId: chainAccount.id,
        documentReference,
        content: memorandumContent,
        status: 'PENDING',
      },
    });

    // Send memorandum emails to all parties
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Email to primary holder
    await sendMemorandumEmail({
      to: primaryHolder.email,
      name: primaryHolder.name || 'User',
      accountName,
      signingToken: primarySigningToken,
      baseUrl,
      role: 'Primary Holder',
    });

    // Emails to co-signatories
    for (const user of coSignatoryUsers) {
      await sendMemorandumEmail({
        to: user.email,
        name: user.name || 'User',
        accountName,
        signingToken: coSignatoryTokens[user.id],
        baseUrl,
        role: 'Co-Signatory',
      });
    }

    // Create notification for primary holder
    await prisma.notification.create({
      data: {
        userId: primaryHolder.id,
        type: 'SYSTEM',
        title: 'Chain Account Application Submitted',
        message: `Your Chain Account application has been submitted. All parties have been emailed the memorandum to review and sign.`,
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Chain Account application submitted successfully',
      chainAccount: {
        id: chainAccount.id,
        accountNumber: chainAccount.accountNumber,
        accountName: chainAccount.accountName,
      },
    });

  } catch (error: any) {
    console.error('Error creating Chain Account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Chain Account' },
      { status: 500 }
    );
  }
}

function generateMemorandumContent(data: any): any {
  const {
    accountNumber,
    accountName,
    documentReference,
    primaryHolder,
    coSignatories,
    formData,
  } = data;

  return {
    documentReference,
    dateIssued: new Date().toISOString(),
    jurisdiction: 'United Arab Emirates',
    accountDetails: {
      accountName,
      chainAccountId: accountNumber,
      accountType: 'Chain Account (Joint Digital Banking)',
      dateOfApplication: new Date().toISOString(),
      primaryApplicant: primaryHolder.name,
      accountPurpose: formData.primaryPurpose,
      purposeDescription: formData.purposeDescription,
      assetTypes: formData.intendedAssetHoldings,
      platformJurisdiction: 'United Arab Emirates',
    },
    parties: [
      {
        fullName: primaryHolder.name,
        email: primaryHolder.email,
        role: 'Primary Holder',
        acredisAccount: primaryHolder.id,
      },
      ...coSignatories.map((cs: any) => ({
        fullName: cs.name,
        email: cs.email,
        role: 'Co-Signatory',
        acredisAccount: cs.id,
      })),
    ],
    financialProfile: {
      expectedMonthlyActivity: formData.expectedMonthlyVolume,
      combinedCapitalLevel: formData.combinedCapitalLevel,
      intendedAssetHoldings: formData.intendedAssetHoldings,
    },
    permissions: {
      authorizationModel: formData.authorizationModel,
      thresholdAmount: formData.thresholdAmount,
      thresholdCurrency: formData.thresholdCurrency,
    },
  };
}

async function sendMemorandumEmail(params: {
  to: string;
  name: string;
  accountName: string;
  signingToken: string;
  baseUrl: string;
  role: string;
}) {
  const { to, name, accountName, signingToken, baseUrl, role } = params;

  const signingLink = `${baseUrl}/chain-account/sign?ref=${signingToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chain Account Memorandum</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Acredis Finance</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Chain Account Memorandum</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Action Required: Review and Sign Memorandum</h2>
        
        <p>Dear ${name},</p>
        
        <p>A Chain Account has been created on Acredis Finance, and you have been included as a <strong>${role}</strong>.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #667eea;">Chain Account Details</h3>
          <p style="margin: 5px 0;"><strong>Account Name:</strong> ${accountName}</p>
          <p style="margin: 5px 0;"><strong>Your Role:</strong> ${role}</p>
        </div>
        
        <p>Before this account can be activated, all parties must review and sign the Chain Account Memorandum. This is a binding legal document that outlines:</p>
        
        <ul style="padding-left: 20px;">
          <li>Account purpose and governance structure</li>
          <li>Roles and responsibilities of all parties</li>
          <li>Transaction authorization rules</li>
          <li>Terms and conditions</li>
        </ul>
        
        <p><strong>Important:</strong> You must be logged into your Acredis account to proceed.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${signingLink}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review & Sign Memorandum
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${signingLink}" style="color: #667eea; word-break: break-all;">${signingLink}</a>
        </p>
        
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Note:</strong> The Chain Account will only activate once ALL parties have signed the memorandum.
          </p>
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Acredis Finance. All rights reserved.<br>
          United Arab Emirates
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: 'Action Required — Review and Sign your Acredis Chain Account Memorandum',
    html,
  });
}
