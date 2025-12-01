/**
 * AI Service for emoji suggestions using Perplexity API.
 *
 * Required environment variable:
 * - PERPLEXITY_API_KEY: Your Perplexity API key (get it from https://www.perplexity.ai/)
 *
 * Optional environment variable:
 * - PERPLEXITY_MODEL: Model name to use for Perplexity (defaults to "sonar")
 *
 * Add this to your config/.env file:
 * PERPLEXITY_API_KEY=your_api_key_here
 * PERPLEXITY_MODEL=sonar
 *
 * @public
 */
export class AiService {
  private apiKey: string | undefined;
  private apiUrl: string = "https://api.perplexity.ai/chat/completions";
  private model: string;

  /**
   * Create a new AiService instance.
   * Reads PERPLEXITY_API_KEY and PERPLEXITY_MODEL from environment variables.
   * @public
   */
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.model = process.env.PERPLEXITY_MODEL || "sonar";
  }

  /**
   * Suggest an emoji based on a tracking question.
   * @param question - The tracking question
   * @returns Promise resolving to suggested emoji string
   * @throws Error if API call fails or API key is missing
   * @public
   */
  async suggestEmoji(question: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Perplexity API key is not configured");
    }

    if (!question || !question.trim()) {
      throw new Error("Question is required");
    }

    const prompt = `Based on this tracking question: "${question.trim()}", suggest a single appropriate emoji that represents the topic or action being tracked. Return only the emoji character, nothing else.`;

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that suggests emojis. Always respond with only a single emoji character, nothing else.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 20,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        let errorText: string;
        try {
          const errorJson = await response.json();
          errorText = JSON.stringify(errorJson, null, 2);
        } catch {
          errorText = await response.text();
        }
        console.error(
          `[${new Date().toISOString()}] AI_SERVICE | Perplexity API error:`,
          response.status,
          response.statusText,
          errorText
        );
        throw new Error(
          `Perplexity API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const emoji = data.choices?.[0]?.message?.content?.trim() || "";

      // Extract emoji from response (handle cases where API might return text with emoji)
      const emojiMatch = emoji.match(/[\p{Emoji}\u{1F300}-\u{1F9FF}]/u);
      if (emojiMatch) {
        return emojiMatch[0];
      }

      // Fallback: return first character if it looks like an emoji
      if (emoji.length > 0) {
        return emoji[0];
      }

      // Default fallback emoji
      return "📝";
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] AI_SERVICE | Error suggesting emoji:`,
        error
      );
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to suggest emoji");
    }
  }
}
