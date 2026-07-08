export async function GET() {
  const tmapApiKey = process.env.TMAP_API_KEY

  if (!tmapApiKey) {
    return Response.json(
      { error: 'TMAP_API_KEY is not configured' },
      { status: 500 }
    )
  }

  return Response.json({ tmapApiKey })
}
