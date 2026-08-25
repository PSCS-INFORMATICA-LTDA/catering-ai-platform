import { requireApiPermission } from '@/Lib/auth/requireApi'
import { uploadAdditionalItemImage } from '@/Lib/additionalItemImageStorage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const { id: itemId } = await context.params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json(
      { success: false, error: 'Formulário inválido.' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { success: false, error: 'Selecione uma imagem (campo file).' },
      { status: 400 },
    )
  }

  const { publicUrl, item, error } = await uploadAdditionalItemImage(itemId, file)

  if (error || !publicUrl || !item) {
    return Response.json(
      {
        success: false,
        error: error ?? 'Falha ao enviar imagem do item adicional.',
      },
      { status: 500 },
    )
  }

  return Response.json({
    success: true,
    image_url: publicUrl,
    item,
  })
}
