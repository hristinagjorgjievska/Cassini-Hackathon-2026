import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = "service_vjke9hq";
const EMAILJS_TEMPLATE_ID = "template_bn7quxa";
const EMAILJS_PUBLIC_KEY = "Iw7xZcQdMxv05Efuw";

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
