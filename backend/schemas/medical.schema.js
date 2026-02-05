export default {
  type: "object",
  properties: {
    patient_name: { type: "string" },
    date: { type: "string", description: "ISO 8601 format" },
    doctor_name: { type: "string" },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: {
            type: "object",
            properties: {
              value: { type: "number" },
              unit: { type: "string", enum: ["mg", "ml", "tablet", "capsule", "drop"] }
            }
          },
          frequency: {
            type: "object",
            properties: {
              times_per_day: { type: "integer" },
              specific_times: { type: "array", items: { type: "string" }, description: "e.g., ['08:00', '20:00']" },
              notes: { type: "string", description: "e.g., After food" }
            }
          },
          duration_days: { type: "integer" }
        },
        required: ["name"]
      }
    },
    summary: { type: "string" }
  },
  required: ["patient_name", "medications"]
};
