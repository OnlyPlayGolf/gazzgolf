import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI-powered Golf Game Setup Assistant. Your job is to interpret natural language descriptions of golf game setups and convert them into structured game configurations.

You must understand and support:

1. **Custom Hole Selection** - Non-standard sequences like:
   - "Play only holes 1-3 and 12-18"
   - "Skip hole 7"
   - "Start on hole 15 and finish on hole 5"

2. **Custom Tee Assignments** - Per-player or per-hole tee rules:
   - "Everyone plays white except Player 3 from blue on par 3s"
   - "Back tees on every hole except hole 12"

3. **Game Format Modifications** - Tweaks to standard formats:
   - "Umbriago but as a 6-hole match"
   - "Stableford with double points on par 3s"
   - "Best ball on front 9, scramble on back 9"

4. **Team Configurations** - Fixed or rotating teams:
   - "Rotating partners every 2 holes"
   - "3 mini-matches of 6 holes each"

5. **Handicap Adjustments** - Fair stroke allocation when tees differ:
   - Players on harder tees get more strokes
   - Adjust based on course rating/slope differences

IMPORTANT RULES:
- Always try to produce a valid, playable configuration
- If information is missing, make reasonable defaults and state your assumptions
- Be conversational - ask clarifying questions if the request is ambiguous
- Return configurations in valid JSON when ready

When you have enough information to build a configuration, respond with your explanation followed by a JSON block wrapped in \`\`\`json and \`\`\` markers.

The JSON should follow this structure:
{
  "baseFormat": "stroke_play" | "umbriago" | "wolf" | "stableford" | "scramble" | "best_ball" | "custom",
  "formatModifications": ["description of any modifications"],
  "holes": [{"holeNumber": 1, "par": 4}, ...],
  "totalHoles": number,
  "playerCount": number,
  "playerNames": ["Player 1", ...],
  "teeAssignments": [{"playerIndex": 0, "playerName": "...", "defaultTee": "white", "holeOverrides": []}],
  "teams": [{"teamId": "A", "teamName": "Team A", "playerIndices": [0, 1]}] | null,
  "teamRotation": boolean,
  "useHandicaps": boolean,
  "handicapAdjustments": [{"playerIndex": 0, "playerName": "...", "adjustedStrokes": 0, "reason": "..."}] | null,
  "mulligansPerPlayer": number,
  "gimmesEnabled": boolean,
  "bonusRules": [{"type": "multiplier", "description": "...", "holes": [], "value": 2}] | null,
  "miniMatches": [{"matchNumber": 1, "holes": [1,2,3,4,5,6], "format": "..."}] | null,
  "assumptions": ["List of assumptions you made"],
  "notes": "Any additional notes"
}

Remember: If you can describe it, we can play it!`;

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
