import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase connection failed" }, { status: 500 });
  }

  const newZealandBanks = [
    { slug: "anz-nz", name: "ANZ", country: "Yeni Zelanda", brand_color: "#00529B", accent_color: "#00A3E0", logo_file: "/bank-logos/nz/anz-nz.png" },
    { slug: "asb-bank", name: "ASB Bank", country: "Yeni Zelanda", brand_color: "#1F3C88", accent_color: "#37A3E0", logo_file: "/bank-logos/nz/asb-bank.png" },
    { slug: "bnz", name: "Bank of New Zealand", country: "Yeni Zelanda", brand_color: "#0033A1", accent_color: "#00AEEF", logo_file: "/bank-logos/nz/bnz.png" },
    { slug: "kiwibank", name: "Kiwibank", country: "Yeni Zelanda", brand_color: "#78BE20", accent_color: "#4D8C15", logo_file: "/bank-logos/nz/kiwibank.png" },
    { slug: "westpac-nz", name: "Westpac New Zealand", country: "Yeni Zelanda", brand_color: "#D71920", accent_color: "#AA1118", logo_file: "/bank-logos/nz/westpac-nz.png" },
    { slug: "tsb-bank-nz", name: "TSB Bank", country: "Yeni Zelanda", brand_color: "#003B7A", accent_color: "#0060A8", logo_file: "/bank-logos/nz/tsb-bank-nz.png" },
    { slug: "co-operative-bank-nz", name: "The Co-operative Bank", country: "Yeni Zelanda", brand_color: "#7B2CBF", accent_color: "#5A189A", logo_file: "/bank-logos/nz/co-operative-bank-nz.png" },
    { slug: "heartland-bank", name: "Heartland Bank", country: "Yeni Zelanda", brand_color: "#8E1B1B", accent_color: "#B3261E", logo_file: "/bank-logos/nz/heartland-bank.png" },
    { slug: "sbs-bank", name: "SBS Bank", country: "Yeni Zelanda", brand_color: "#006A52", accent_color: "#00836A", logo_file: "/bank-logos/nz/sbs-bank.png" },
    { slug: "rabobank-nz", name: "Rabo Bank", country: "Yeni Zelanda", brand_color: "#003D8F", accent_color: "#F57C00", logo_file: "/bank-logos/nz/rabobank-nz.png" },
  ];

  const { error } = await supabase.from("banks").upsert(newZealandBanks, { onConflict: "slug" });

  if (error) {
    console.error("Supabase upsert error:", error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "New Zealand banks seeded successfully" });
}
