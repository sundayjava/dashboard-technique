import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// GET - Fetch all contact messages (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const messages = await prisma.contactMessage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get counts for stats
    const stats = {
      total: await prisma.contactMessage.count(),
      pending: await prisma.contactMessage.count({ where: { status: 'PENDING' } }),
      replied: await prisma.contactMessage.count({ where: { status: 'REPLIED' } }),
      closed: await prisma.contactMessage.count({ where: { status: 'CLOSED' } }),
    };

    return NextResponse.json({ messages, stats });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// PUT - Reply to contact message
export async function PUT(request: NextRequest) {
  try {
    const { id, adminReply, repliedBy, status } = await request.json();

    if (!id || !adminReply || !repliedBy) {
      return NextResponse.json(
        { error: 'Message ID, reply, and admin ID are required' },
        { status: 400 }
      );
    }

    // Get the contact message
    const contactMessage = await prisma.contactMessage.findUnique({
      where: { id },
    });

    if (!contactMessage) {
      return NextResponse.json(
        { error: 'Contact message not found' },
        { status: 404 }
      );
    }

    // Update contact message
    const updatedMessage = await prisma.contactMessage.update({
      where: { id },
      data: {
        adminReply,
        repliedBy,
        repliedAt: new Date(),
        status: status || 'REPLIED',
      },
    });

    // Send email to user
    try {
      await sendEmail({
        to: contactMessage.email,
        subject: `Re: ${contactMessage.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Response from Acredis Finance Support</h2>
            <p>Dear ${contactMessage.name},</p>
            <p>Thank you for contacting us. Here is our response to your inquiry:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #374151;"><strong>Your Message:</strong></p>
              <p style="margin: 10px 0 0 0; color: #6b7280;">${contactMessage.message}</p>
            </div>

            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46;"><strong>Our Response:</strong></p>
              <p style="margin: 10px 0 0 0; color: #047857; white-space: pre-wrap;">${adminReply}</p>
            </div>

            <p>If you have any further questions, please don't hesitate to contact us again.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br/>
              <strong>Acredis Finance Support Team</strong>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              This is an automated email. Please do not reply directly to this message.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      message: 'Reply sent successfully',
      contactMessage: updatedMessage,
    });
  } catch (error) {
    console.error('Error replying to contact message:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

// DELETE - Delete contact message
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    await prisma.contactMessage.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
