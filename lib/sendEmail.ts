import emailjs from '@emailjs/browser';

/**
 * Sends an email notification to the user when satellite data finishes analyzing.
 * You'll need to set up an account at https://www.emailjs.com/
 * 
 * Replace these placeholder keys with your actual EmailJS keys from your dashboard.
 */
const EMAILJS_SERVICE_ID = "service_vjke9hq"; // e.g. service_xxxxxxx
const EMAILJS_TEMPLATE_ID = "template_bn7quxa"; // e.g. template_xxxxxxx
const EMAILJS_PUBLIC_KEY = "Iw7xZcQdMxv05Efuw"; // e.g. xyz123ABC

export async function sendAnalysisCompleteEmail(
  userEmail: string,
  locationName: string,
  disturbances: string[],
  pollutionStatus: string
) {
  try {
    // Format the list of disturbances into a readable string
    const disturbancesList = disturbances.length > 0
      ? disturbances.join(", ")
      : "None detected";

    const templateParams = {
      to_email: userEmail,
      location_name: locationName,
      pollution_status: pollutionStatus,
      disturbances_list: disturbancesList,
      // You can add more variables here that match your EmailJS template
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
