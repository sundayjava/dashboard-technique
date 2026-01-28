import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber, email, countryCode, phoneNumber, topic, message } = body;

    // Validate required fields
    if (!accountNumber || !email || !phoneNumber || !topic || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Create support request in database
    const supportRequest = await prisma.supportRequest.create({
      data: {
        accountNumber,
        email,
        countryCode,
        phoneNumber,
        topic,
        message,
      },
    });

    // Get all admin emails from database
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true },
    });

    // Send notification email to all admins
    if (admins.length > 0) {
      const emailPromises = admins.map(async (admin) => {
        try {
          await sendEmail({
            to: admin.email,
            subject: `New Support Request: ${topic}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(to right, #c1ff72, #a6d64a); padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="color: #1a1a1a; margin: 0;">New Support Request</h2>
              </div>
              
              <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h3 style="color: #1a1a1a; margin-top: 0;">Request Details</h3>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #4b5563;">Topic:</strong>
                      </td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">
                        ${topic}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #4b5563;">Account Number:</strong>
                      </td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">
                        ${accountNumber}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #4b5563;">Email:</strong>
                      </td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">
                        ${email}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #4b5563;">Phone:</strong>
                      </td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">
                        ${countryCode} ${phoneNumber}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <strong style="color: #4b5563;">Request ID:</strong>
                      </td>
                      <td style="padding: 10px 0; color: #1a1a1a;">
                        ${supportRequest.id}
                      </td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px;">
                  <h3 style="color: #1a1a1a; margin-top: 0;">Message</h3>
                  <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>Action Required:</strong> Please review and respond to this support request in the admin panel.
                  </p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
                <p>This is an automated notification from Acredis Finance Support System</p>
                <p>Submitted on ${new Date().toLocaleString()}</p>
              </div>
            </div>
          `,
        });
        } catch (emailError) {
          console.error(`Failed to send admin notification to ${admin.email}:`, emailError);
        }
      });

      await Promise.allSettled(emailPromises);
    } else {
      console.warn('No admin users found to notify');
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        to: email,
        subject: 'Support Request Received - Acredis Finance',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(to right, #c1ff72, #a6d64a); padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="color: #1a1a1a; margin: 0;">Support Request Received</h2>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="color: #374151; font-size: 16px;">Hello,</p>
              
              <p style="color: #374151; line-height: 1.6;">
                Thank you for contacting Acredis Finance support. We have received your request regarding <strong>${topic}</strong>.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Request ID:</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 18px; font-weight: bold;">${supportRequest.id}</p>
              </div>
              
              <p style="color: #374151; line-height: 1.6;">
                Our support team will review your request and get back to you within 24-48 hours at the email address you provided.
              </p>
              
              <div style="margin-top: 20px; padding: 15px; background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">
                  <strong>What's Next?</strong><br>
                  Keep an eye on your inbox. We'll contact you as soon as possible with a solution or next steps.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
              <p>Need immediate assistance? Contact us at support@acredis.com or +1 (800) 123-4567</p>
              <p style="margin-top: 10px;">© ${new Date().getFullYear()} Acredis Finance. All rights reserved.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send user confirmation email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Support request submitted successfully',
      requestId: supportRequest.id,
    });
  } catch (error) {
    console.error('Error creating support request:', error);
    return NextResponse.json(
      { error: 'Failed to submit support request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? { status: status as any } : {};

    const supportRequests = await prisma.supportRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ supportRequests });
  } catch (error) {
    console.error('Error fetching support requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch support requests' },
      { status: 500 }
    );
  }
}
