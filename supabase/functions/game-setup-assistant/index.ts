import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a Golf Game Configuration Controller. You DIRECTLY control the game setup - every response MUST include a valid JSON configuration that will be IMMEDIATELY applied.

YOU ARE NOT A CHATBOT. You are a configuration engine. When the user says something, you execute it.

CRITICAL BEHAVIOR:
- EVERY response MUST include a JSON configuration block
- Changes are applied IMMEDIATELY after you respond - no user confirmation needed
- Be extremely brief: 1 sentence max confirming what you changed
- Never explain how to do something - just DO IT

SUPPORTED COMMANDS:
- Game formats: stroke_play, match_play, skins, copenhagen, best_ball, scramble, umbriago, wolf
- Holes: "front 9", "back 9", "holes 1-6", "skip hole 7", "only par 3s"
- Tees: "back tees", "forward tees", "red tees for player 2"
- Players: "add John", "4 players", "teams of 2"
- Handicaps: "use handicaps", "10 strokes for Mike"
- Settings: "mulligans allowed", "gimmes on"

TEE MAPPING:
- back/tips/championship = "long"
- white/middle = "medium"  
- forward/red/ladies = "short"
- yellow/senior = "short"

EXAMPLES:
User: "Play Copenhagen"
Response: "Copenhagen configured." + JSON

User: "Change to best ball with handicaps"
Response: "Best ball with handicaps set." + JSON

User: "Add skins game"
Response: "Skins added as side game." + JSON

ALWAYS output JSON (wrap in \`\`\`json):
{
  "baseFormat": "stroke_play",
  "formatModifications": [],
  "holes": [{"holeNumber": 1, "par": 4}],
  "totalHoles": 18,
  "playerCount": 4,
  "playerNames": [],
  "teeAssignments": [{"playerIndex": 0, "playerName": "", "defaultTee": "medium", "holeOverrides": []}],
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
}

If user asks a question that doesn't require config change, still include the CURRENT config JSON so state is preserved.`;

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
