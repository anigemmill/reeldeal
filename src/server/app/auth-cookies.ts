/* Cookie names and limits shared by the auth server actions and the verification page. */
/** The address waiting for confirmation, so /verify-email can show it and resend without asking again. httpOnly. */
export const VERIFY_EMAIL_COOKIE = "rd_verify_email";
/** When the last confirmation email was sent from this browser (resend cooldown). httpOnly. */
export const RESEND_COOLDOWN_COOKIE = "rd_verify_sent";
export const RESEND_COOLDOWN_SECONDS = 60;
