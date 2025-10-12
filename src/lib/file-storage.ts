// src/lib/file-storage.ts
'use client';

export interface FileUploadResult {
  url: string;
  path: string;
}

export async function saveFile(file: File | Blob, fileName: string): Promise<FileUploadResult> {
  const formData = new FormData();
  formData.append('file', file, fileName);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Error al subir el archivo');
  }

  return response.json();
}

export async function saveBase64Image(base64String: string, fileName: string): Promise<FileUploadResult> {
  // Convertir base64 a Blob
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: 'image/jpeg' });
  return saveFile(blob, fileName);
}