import emailjs from '@emailjs/browser';

/**
 * EMAILJS CONFIGURATION GUIDE:
 * To use this emailing system, you need to set up an account at https://www.emailjs.com/
 * 
 * 1. EMAILJS_SERVICE_ID: Found in 'Email Services' tab after adding a service (e.g., Gmail, Outlook).
 * 2. EMAILJS_TEMPLATE_ID: Found in 'Email Templates' tab after creating a template.
 *    - Make sure your template uses these variables: {{to_email}}, {{location_name}}, {{pollution_status}}, {{disturbances_list}}
 * 3. EMAILJS_PUBLIC_KEY: Found in 'Account' -> 'API Keys' section.
 */
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";

export async function sendAnalysisCompleteEmail(
  userEmail: string,
  locationName: string,
  disturbances: string[],
  pollutionStatus: string
) {
  try {
    const disturbancesList = disturbances.length > 0
      ? disturbances.join(", ")
      : "None detected";

    const templateParams = {
      to_email: userEmail,
      location_name: locationName,
      pollution_status: pollutionStatus,
      disturbances_list: disturbancesList,
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log("Email sent successfully!", response.status, response.text);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
