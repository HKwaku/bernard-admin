// /api/diagnostic-chat.js (Vercel serverless function)
// Diagnostic endpoint to test tool loading

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasSupabaseURL: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_ANON_KEY || !!process.env.VITE_SUPABASE_ANON_KEY,
        nodeVersion: process.version,
      },
      toolLoadingTest: null,
      error: null,
    };

    try {
      // Try to import bernardTools
      const bernardTools = await import("../src/bernardTools.js");
      
      const tools = [
        bernardTools.listRoomsTool,
        bernardTools.listExtrasTool,
        bernardTools.listPackagesTool,
        bernardTools.listCouponsTool,
        bernardTools.getTodayCheckInsTool,
        bernardTools.getTodayCheckOutsTool,
        bernardTools.listPricingModelsTool,
      ];

      const toolStatus = tools.map(tool => ({
        name: tool?.name || 'UNKNOWN',
        hasSchema: !!tool?.schema,
        schemaType: tool?.schema ? typeof tool.schema : 'undefined',
      }));

      diagnostics.toolLoadingTest = {
        success: true,
        toolsChecked: toolStatus.length,
        toolStatus,
      };
    } catch (importError) {
      diagnostics.toolLoadingTest = {
        success: false,
        error: importError.message,
        stack: importError.stack,
      };
    }

    return res.status(200).json(diagnostics);
  } catch (e) {
    console.error("Diagnostic error:", e);
    return res.status(500).json({ 
      error: e?.message || "Server error",
      stack: e?.stack 
    });
  }
}