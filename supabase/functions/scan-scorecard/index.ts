import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL')
    const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY')
    if (!AI_GATEWAY_URL) {
      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_URL is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    if (!AI_GATEWAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_API_KEY is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Call the AI gateway to analyze the scorecard
    const gatewayUrl = `${AI_GATEWAY_URL.replace(/\/$/, '')}/v1/chat/completions`
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this golf scorecard image and extract the following information in JSON format:

{
  "courseName": "The name of the golf course",
  "city": "The city where the course is located",
  "stateOrCountry": "The state (if USA) or country name",
  "isUSA": true/false,
  "countryCode": "Two-letter country code (e.g., US, SE, GB, ES)",
  "holes": [
    {
      "holeNumber": 1,
      "par": 4,
      "distance": 380,
      "strokeIndex": 7
    }
  ]
}

Important:
- Extract all visible holes (could be 9 or 18)
- For distance, use the most prominent yardage/meters shown (usually the middle tees)
- If you can't determine a specific field, use null
- Stroke index might be labeled as "HCP", "SI", "Index", or similar
- Look for course name at the top of the scorecard
- Location info might be in the header, footer, or logo area
- If you see a US state abbreviation (CA, FL, TX, etc), it's a USA course
- Be thorough in examining all parts of the image for the course name and location

Return ONLY the JSON object, no markdown or additional text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        modalities: ["text"]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to analyze scorecard' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const aiResponse = await response.json()
    const content = aiResponse.choices?.[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Parse the JSON from the AI response
    let parsedData
    try {
      // Remove any markdown code blocks if present
      const jsonString = content.replace(/```json\n?|\n?```/g, '').trim()
      parsedData = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Error parsing AI response:', content)
      return new Response(
        JSON.stringify({ error: 'Failed to parse scorecard data', rawResponse: content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify(parsedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
