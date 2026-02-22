import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PrescriptionResult {
  status: "success" | "partial" | "error";
  confidence: number;
  extracted_text: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string;
    confidence: number;
  }>;
  metadata: {
    prescription_date: string;
    doctor_name: string;
    image_quality: "good" | "fair" | "poor";
    has_handwriting: boolean;
  };
  errors: string[];
}

export async function processPrescriptionImage(base64Image: string, mimeType: string): Promise<PrescriptionResult> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    You are a professional medical OCR engine. 
    Analyze the provided prescription image and extract all details into the specified JSON format.
    Be precise with medication names, dosages, and instructions.
    If a field is not found, use an empty string or null as appropriate.
    
    JSON Schema:
    {
      "status": "success|partial|error",
      "confidence": float (0-1),
      "extracted_text": "full raw text extracted",
      "medications": [
        {
          "name": "drug name",
          "dosage": "e.g. 500mg",
          "frequency": "e.g. twice a day",
          "duration": "e.g. 7 days",
          "quantity": number,
          "instructions": "any special instructions",
          "confidence": float (0-1)
        }
      ],
      "metadata": {
        "prescription_date": "YYYY-MM-DD",
        "doctor_name": "name of the doctor",
        "image_quality": "good|fair|poor",
        "has_handwriting": boolean
      },
      "errors": []
    }
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(",")[1] || base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          extracted_text: { type: Type.STRING },
          medications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                duration: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                instructions: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ["name", "dosage", "frequency", "duration", "quantity", "instructions", "confidence"],
            },
          },
          metadata: {
            type: Type.OBJECT,
            properties: {
              prescription_date: { type: Type.STRING },
              doctor_name: { type: Type.STRING },
              image_quality: { type: Type.STRING },
              has_handwriting: { type: Type.BOOLEAN },
            },
            required: ["prescription_date", "doctor_name", "image_quality", "has_handwriting"],
          },
          errors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["status", "confidence", "extracted_text", "medications", "metadata", "errors"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as PrescriptionResult;
}
