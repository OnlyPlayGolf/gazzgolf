import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a Golf Game Setup Assistant. Convert natural language into game configurations.

BE CONCISE. Keep responses to 1-3 short sentences max. No long explanations.

You support:
- Custom holes (e.g., "holes 1-9 and 15-18", "skip hole 7")
- Custom tees per player/hole
- Format mods (e.g., "Umbriago 6 holes", "scramble back 9")
- Teams (fixed or rotating)
- Handicap adjustments for mixed tees

RULES:
- Give short, direct answers
- Use defaults if info is missing, briefly note assumptions
- Only ask ONE clarifying question if truly needed
- Output JSON when ready

JSON structure (wrap in \`\`\`json):
{
  "baseFormat": "stroke_play" | "umbriago" | "wolf" | "stableford" | "scramble" | "best_ball" | "custom",
  "formatModifications": [],
  "holes": [{"holeNumber": 1, "par": 4}],
  "totalHoles": 18,
  "playerCount": 4,
  "playerNames": [],
  "teeAssignments": [{"playerIndex": 0, "playerName": "", "defaultTee": "white", "holeOverrides": []}],
  "teams": null,
  "teamRotation": false,
  "useHandicaps": false,
  "handicapAdjustments": null,
  "mulligansPerPlayer": 0,
  "gimmesEnabled": false,
  "bonusRules": null,
  "miniMatches": null,
  "assumptions": [],
  "notes": ""
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, courseInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context with course info if available
    let systemMessage = SYSTEM_PROMPT;
    if (courseInfo) {
      systemMessage += `\n\nCURRENT COURSE INFO:
- Course Name: ${courseInfo.courseName}
- Available Tees: ${courseInfo.availableTees?.join(', ') || 'White, Yellow, Blue, Red'}
- Default Holes: ${courseInfo.defaultHoles || 18}
${courseInfo.courseHoles ? `- Hole Data: ${JSON.stringify(courseInfo.courseHoles)}` : ''}`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Game setup assistant error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
