import { requireApiPermission } from '@/Lib/auth/requireApi'
import { uploadPackageImage } from '@/Lib/packageImageStorage'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const { id: packageId } = await context.params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Formulário inválido.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'Selecione uma imagem.' }, { status: 400 })
  }

  const { publicUrl, error } = await uploadPackageImage(packageId, file)

  if (error || !publicUrl) {
    return Response.json(
      { error: error ?? 'Falha ao enviar imagem.' },
      { status: 500 },
    )
  }

  return Response.json({ image_url: publicUrl })
}
