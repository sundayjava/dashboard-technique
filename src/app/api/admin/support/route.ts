import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// GET - Fetch all contact messages and support requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Fetch contact messages
    const contactMessages = await prisma.contactMessage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch support requests
    const supportRequests = await prisma.supportRequest.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Combine and transform to unified format
    const messages = [
      ...contactMessages.map(msg => ({
        id: msg.id,
        type: 'CONTACT' as const,
        name: msg.name,
        email: msg.email,
        subject: msg.subject,
        message: msg.message,
        status: msg.status,
        adminReply: msg.adminReply,
        repliedAt: msg.repliedAt,
        repliedBy: msg.repliedBy,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      ...supportRequests.map(req => ({
        id: req.id,
        type: 'SUPPORT' as const,
        name: '', // Support requests don't have name
        email: req.email,
        subject: req.topic,
        message: req.message,
        accountNumber: req.accountNumber,
        countryCode: req.countryCode,
        phoneNumber: req.phoneNumber,
        status: req.status,
        adminReply: req.adminReply,
        repliedAt: req.repliedAt,
        repliedBy: req.repliedBy,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get counts for stats
    const contactStats = {
      total: await prisma.contactMessage.count(),
      pending: await prisma.contactMessage.count({ where: { status: 'PENDING' } }),
      replied: await prisma.contactMessage.count({ where: { status: 'REPLIED' } }),
      closed: await prisma.contactMessage.count({ where: { status: 'CLOSED' } }),
    };

    const supportStats = {
      total: await prisma.supportRequest.count(),
      pending: await prisma.supportRequest.count({ where: { status: 'PENDING' } }),
      replied: await prisma.supportRequest.count({ where: { status: 'REPLIED' } }),
      closed: await prisma.supportRequest.count({ where: { status: 'CLOSED' } }),
    };

    const stats = {
      total: contactStats.total + supportStats.total,
      pending: contactStats.pending + supportStats.pending,
      replied: contactStats.replied + supportStats.replied,
      closed: contactStats.closed + supportStats.closed,
      contactMessages: contactStats.total,
      supportRequests: supportStats.total,
    };

    return NextResponse.json({ messages, stats });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// PUT - Reply to contact message or support request
export async function PUT(request: NextRequest) {
  try {
    const { id, type, adminReply, repliedBy, status } = await request.json();

    if (!id || !type || !adminReply || !repliedBy) {
      return NextResponse.json(
        { error: 'Message ID, type, reply, and admin ID are required' },
        { status: 400 }
      );
    }

    let updatedMessage: any;
    let userEmail: string;
    let userName: string = '';
    let originalMessage: string;
    let messageSubject: string;

    if (type === 'CONTACT') {
      // Handle contact message
      const contactMessage = await prisma.contactMessage.findUnique({
        where: { id },
      });

      if (!contactMessage) {
        return NextResponse.json(
          { error: 'Contact message not found' },
          { status: 404 }
        );
      }

      updatedMessage = await prisma.contactMessage.update({
        where: { id },
        data: {
          adminReply,
          repliedBy,
          repliedAt: new Date(),
          status: status || 'REPLIED',
        },
      });

      userEmail = contactMessage.email;
      userName = contactMessage.name;
      originalMessage = contactMessage.message;
      messageSubject = contactMessage.subject;
    } else if (type === 'SUPPORT') {
      // Handle support request
      const supportRequest = await prisma.supportRequest.findUnique({
        where: { id },
      });

      if (!supportRequest) {
        return NextResponse.json(
          { error: 'Support request not found' },
          { status: 404 }
        );
      }

      updatedMessage = await prisma.supportRequest.update({
        where: { id },
        data: {
          adminReply,
          repliedBy,
          repliedAt: new Date(),
          status: status || 'REPLIED',
        },
      });

      userEmail = supportRequest.email;
      originalMessage = supportRequest.message;
      messageSubject = supportRequest.topic;
    } else {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    // Send email to user
    try {
      await sendEmail({
        to: userEmail,
        subject: `Re: ${messageSubject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Response from Acredis Finance Support</h2>
            ${userName ? `<p>Dear ${userName},</p>` : '<p>Dear valued customer,</p>'}
            <p>Thank you for contacting us. Here is our response to your inquiry:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #374151;"><strong>Your Message:</strong></p>
              <p style="margin: 10px 0 0 0; color: #6b7280;">${originalMessage}</p>
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
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

// DELETE - Delete contact message or support request
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json(
        { error: 'Message ID and type are required' },
        { status: 400 }
      );
    }

    if (type === 'CONTACT') {
      await prisma.contactMessage.delete({
        where: { id },
      });
    } else if (type === 'SUPPORT') {
      await prisma.supportRequest.delete({
        where: { id },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
