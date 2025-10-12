import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generar nombre único
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.[^/.]+$/, '');
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${originalName}.${extension}`;
    
    // Guardar en /public/uploads
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const filePath = join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);
    
    return NextResponse.json({ 
      url: `/uploads/${fileName}`,
      path: filePath
    });
    
  } catch (error) {
    console.error('Error al subir archivo:', error);
    return NextResponse.json(
      { error: 'Error al procesar el archivo' },
      { status: 500 }
    );
  }
}