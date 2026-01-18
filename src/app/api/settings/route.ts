import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper function to get a setting value
export async function getSettingValue(key: string): Promise<number | string | boolean | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) return null;

    // Parse value based on type
    switch (setting.type) {
      case 'number':
        return parseFloat(setting.value);
      case 'boolean':
        return setting.value === 'true';
      case 'json':
        return JSON.parse(setting.value);
      default:
        return setting.value;
    }
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return null;
  }
}

// GET - Get all settings or specific setting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const category = searchParams.get('category');

    // Get specific setting by key
    if (key) {
      const value = await getSettingValue(key);
      if (value === null) {
        return NextResponse.json(
          { error: 'Setting not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ key, value });
    }

    // Get settings by category
    if (category) {
      const settings = await prisma.systemSetting.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      });
      return NextResponse.json({ settings });
    }

    // Get all settings grouped by category
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group by category
    const grouped = settings.reduce((acc: any, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        description: setting.description,
      });
      return acc;
    }, {});

    return NextResponse.json({ settings: grouped });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update a setting (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!existingSetting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    // Validate value based on type
    let stringValue: string;
    switch (existingSetting.type) {
      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return NextResponse.json(
            { error: 'Invalid number value' },
            { status: 400 }
          );
        }
        stringValue = numValue.toString();
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return NextResponse.json(
            { error: 'Invalid boolean value' },
            { status: 400 }
          );
        }
        stringValue = value.toString();
        break;
      case 'json':
        stringValue = JSON.stringify(value);
        break;
      default:
        stringValue = value.toString();
    }

    // Update setting
    const updated = await prisma.systemSetting.update({
      where: { key },
      data: { value: stringValue },
    });

    return NextResponse.json({
      message: 'Setting updated successfully',
      setting: {
        key: updated.key,
        value: updated.value,
        type: updated.type,
      },
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}

// POST - Create a new setting (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, type = 'string', category = 'general', description } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    // Check if setting already exists
    const existing = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Setting already exists' },
        { status: 409 }
      );
    }

    // Create setting
    const setting = await prisma.systemSetting.create({
      data: {
        key,
        value: value.toString(),
        type,
        category,
        description,
      },
    });

    return NextResponse.json({
      message: 'Setting created successfully',
      setting,
    });
  } catch (error) {
    console.error('Error creating setting:', error);
    return NextResponse.json(
      { error: 'Failed to create setting' },
      { status: 500 }
    );
  }
}
