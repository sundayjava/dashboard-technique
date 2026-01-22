import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get('published');

    const where: any = {};
    if (published === 'true') {
      where.published = true;
    } else if (published === 'false') {
      where.published = false;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST - Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, links, published, authorId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        links: links || null,
        published: published || false,
        authorId: authorId || null
      }
    });

    return NextResponse.json({
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}

// PUT - Update a post
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, links, published } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(links !== undefined && { links }),
        ...(published !== undefined && { published })
      }
    });

    return NextResponse.json({
      message: 'Post updated successfully',
      post: updatedPost
    });

  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a post
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    await prisma.post.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
