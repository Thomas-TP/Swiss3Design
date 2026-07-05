import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"

const ALLOWED_EXTENSIONS = [".stl", ".3mf", ".obj"]
const MAX_SIZE_BYTES = 30 * 1024 * 1024 // 30 MB, matches current /api/quote-upload

export async function POST(
  req: MedusaRequest & { file?: Express.Multer.File },
  res: MedusaResponse
) {
  const file = req.file
  if (!file) {
    return res.status(400).json({ message: "No file was uploaded" })
  }

  const lowerName = file.originalname.toLowerCase()
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return res.status(400).json({ message: "File must be .stl, .3mf or .obj" })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return res.status(400).json({ message: "File must be 30 MB or smaller" })
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          content: file.buffer.toString("base64"),
          access: "private",
        },
      ],
    },
  })

  res.status(200).json({ file_url: result[0].url, file_name: file.originalname })
}
