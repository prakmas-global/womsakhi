"""
The skills a woman can say she has, for onboarding and her work profile.

About two hundred of the ways women in India earn from home or go out to work,
in plain words. It is a vocabulary, not a register: nothing here says she is
certified in anything, and a woman whose skill is missing types her own, which
is stored as `{"custom": "..."}` beside the keys (see app/core/onboarding.py).

Every skill has:

- `key` — stable, stored on her answers. Never rename one; add a new key.
- `label` — English. The client translates labels like any other string.
- `group` — one of `GROUPS`, for the picker's sections and the admin counts.
- `service_category` — the shop's service category a listing made from this
  skill goes under. These are the categories the shop screens already offer
  (`SERVICE_CATEGORIES` in the frontend's components/ux/shop/data.ts); the
  backend stores `category` as free text, so this is the one place they meet.
- `popular` — the dozen shown before she types anything.

`search` is a prefix-then-substring match on the label, popular first. It
reads nothing about any person, so it is safe to answer before admission.
"""

from __future__ import annotations

#: The shop's service categories, exactly as the frontend offers them.
SERVICE_CATEGORIES = (
    "Tailoring", "Beauty", "Teaching", "Cooking", "Childcare", "Cleaning", "Repairs", "Other",
)

#: group key -> (label, default service category)
GROUPS: dict[str, tuple[str, str]] = {
    "tailoring_fashion": ("Tailoring & fashion", "Tailoring"),
    "handicrafts": ("Handicrafts", "Other"),
    "beauty_wellness": ("Beauty & wellness", "Beauty"),
    "food_cooking": ("Food & cooking", "Cooking"),
    "teaching_tuition": ("Teaching & tuition", "Teaching"),
    "office_digital": ("Office & digital", "Other"),
    "care_work": ("Care work", "Childcare"),
    "home_services": ("Home services", "Cleaning"),
    "farming_animals": ("Farming & animal care", "Other"),
    "retail_sales": ("Retail & sales", "Other"),
    "arts_performance": ("Arts & performance", "Teaching"),
    "repairs_technical": ("Repairs & technical", "Repairs"),
    "community_finance": ("Community & finance", "Other"),
    "events_hospitality": ("Events & hospitality", "Other"),
}

#: (key, label, group, popular, service_category override or "")
_RAW: list[tuple[str, str, str, bool, str]] = [
    # ── tailoring & fashion ─────────────────────────────────────────────
    ("tailoring", "Tailoring", "tailoring_fashion", True, ""),
    ("blouse_stitching", "Blouse stitching", "tailoring_fashion", False, ""),
    ("salwar_suit_stitching", "Salwar suit stitching", "tailoring_fashion", False, ""),
    ("alterations", "Alterations and re-fitting", "tailoring_fashion", False, ""),
    ("kids_clothing", "Children's clothing", "tailoring_fashion", False, ""),
    ("lehenga_stitching", "Lehenga stitching", "tailoring_fashion", False, ""),
    ("saree_fall_pico", "Saree fall and pico", "tailoring_fashion", False, ""),
    ("pattern_making", "Pattern making", "tailoring_fashion", False, ""),
    ("fashion_design", "Fashion design", "tailoring_fashion", False, ""),
    ("uniform_stitching", "School uniform stitching", "tailoring_fashion", False, ""),
    ("curtain_stitching", "Curtains and cushion covers", "tailoring_fashion", False, ""),
    ("bag_making", "Cloth bag making", "tailoring_fashion", False, ""),
    ("nightwear_stitching", "Nightwear stitching", "tailoring_fashion", False, ""),
    ("boutique_running", "Running a boutique", "tailoring_fashion", False, ""),
    ("hand_embroidery", "Hand embroidery", "tailoring_fashion", True, ""),
    ("machine_embroidery", "Machine embroidery", "tailoring_fashion", False, ""),
    ("zardosi", "Zardozi work", "tailoring_fashion", False, ""),
    ("aari_work", "Aari work", "tailoring_fashion", False, ""),
    ("mirror_work", "Mirror work", "tailoring_fashion", False, ""),
    ("chikankari", "Chikankari", "tailoring_fashion", False, ""),
    ("phulkari", "Phulkari", "tailoring_fashion", False, ""),
    ("kantha_stitch", "Kantha stitch", "tailoring_fashion", False, ""),
    ("smocking", "Smocking", "tailoring_fashion", False, ""),
    ("dupatta_finishing", "Dupatta finishing and lace work", "tailoring_fashion", False, ""),
    # ── handicrafts ──────────────────────────────────────────────────────
    ("knitting", "Knitting", "handicrafts", False, ""),
    ("crochet", "Crochet", "handicrafts", False, ""),
    ("block_printing", "Block printing", "handicrafts", False, ""),
    ("tie_dye", "Tie and dye", "handicrafts", False, ""),
    ("bandhani", "Bandhani", "handicrafts", False, ""),
    ("candle_making", "Candle making", "handicrafts", False, ""),
    ("soap_making", "Soap making", "handicrafts", False, ""),
    ("jewellery_making", "Jewellery making", "handicrafts", True, ""),
    ("bead_work", "Bead work", "handicrafts", False, ""),
    ("pottery", "Pottery", "handicrafts", False, ""),
    ("terracotta", "Terracotta", "handicrafts", False, ""),
    ("clay_modelling", "Clay modelling", "handicrafts", False, ""),
    ("macrame", "Macrame", "handicrafts", False, ""),
    ("basket_weaving", "Basket weaving", "handicrafts", False, ""),
    ("bamboo_craft", "Bamboo craft", "handicrafts", False, ""),
    ("jute_products", "Jute products", "handicrafts", False, ""),
    ("paper_quilling", "Paper quilling", "handicrafts", False, ""),
    ("paper_bags", "Paper bag making", "handicrafts", False, ""),
    ("madhubani", "Madhubani painting", "handicrafts", False, ""),
    ("warli", "Warli art", "handicrafts", False, ""),
    ("rangoli", "Rangoli", "handicrafts", False, ""),
    ("toran_making", "Toran and door hangings", "handicrafts", False, ""),
    ("rakhi_making", "Rakhi making", "handicrafts", False, ""),
    ("diya_painting", "Diya painting", "handicrafts", False, ""),
    ("resin_art", "Resin art", "handicrafts", False, ""),
    ("doll_making", "Doll and soft toy making", "handicrafts", False, ""),
    ("handloom_weaving", "Handloom weaving", "handicrafts", False, ""),
    ("carpet_weaving", "Carpet and dhurrie weaving", "handicrafts", False, ""),
    ("lac_bangles", "Lac bangles", "handicrafts", False, ""),
    ("gift_hampers", "Gift hampers and packing", "handicrafts", False, ""),
    ("glass_painting", "Glass painting", "handicrafts", False, ""),
    ("fabric_painting", "Fabric painting", "handicrafts", False, ""),
    ("patchwork_quilting", "Patchwork and quilting", "handicrafts", False, ""),
    ("incense_sticks", "Agarbatti making", "handicrafts", False, ""),
    ("artificial_flowers", "Artificial flowers", "handicrafts", False, ""),
    ("home_decor_crafts", "Home decor crafts", "handicrafts", False, ""),
    # ── beauty & wellness ───────────────────────────────────────────────
    ("beautician", "Beautician", "beauty_wellness", True, ""),
    ("makeup", "Makeup", "beauty_wellness", False, ""),
    ("bridal_makeup", "Bridal makeup", "beauty_wellness", False, ""),
    ("mehendi", "Mehendi", "beauty_wellness", True, ""),
    ("threading", "Threading", "beauty_wellness", False, ""),
    ("waxing", "Waxing", "beauty_wellness", False, ""),
    ("facial", "Facials", "beauty_wellness", False, ""),
    ("manicure_pedicure", "Manicure and pedicure", "beauty_wellness", False, ""),
    ("hair_cutting", "Hair cutting", "beauty_wellness", False, ""),
    ("hair_styling", "Hair styling", "beauty_wellness", False, ""),
    ("nail_art", "Nail art", "beauty_wellness", False, ""),
    ("saree_draping", "Saree draping", "beauty_wellness", False, ""),
    ("skin_care", "Skin care", "beauty_wellness", False, ""),
    ("spa_therapy", "Spa therapy", "beauty_wellness", False, ""),
    ("yoga_teaching", "Yoga teaching", "beauty_wellness", False, "Teaching"),
    ("fitness_training", "Fitness and zumba classes", "beauty_wellness", False, "Teaching"),
    ("herbal_products", "Herbal beauty products", "beauty_wellness", False, ""),
    # ── food & cooking ──────────────────────────────────────────────────
    ("home_cooking", "Home cooking", "food_cooking", True, ""),
    ("tiffin_service", "Tiffin service", "food_cooking", True, ""),
    ("baking", "Baking", "food_cooking", False, ""),
    ("cake_decorating", "Cake decorating", "food_cooking", False, ""),
    ("pickle_making", "Pickle making", "food_cooking", True, ""),
    ("papad_making", "Papad making", "food_cooking", False, ""),
    ("masala_making", "Masala and spice mixes", "food_cooking", False, ""),
    ("snacks_making", "Namkeen and snacks", "food_cooking", False, ""),
    ("sweets_making", "Sweets and mithai", "food_cooking", False, ""),
    ("catering", "Catering", "food_cooking", False, ""),
    ("chocolate_making", "Chocolate making", "food_cooking", False, ""),
    ("jam_making", "Jams and preserves", "food_cooking", False, ""),
    ("millet_foods", "Millet foods", "food_cooking", False, ""),
    ("batter_making", "Idli and dosa batter", "food_cooking", False, ""),
    ("chapati_making", "Chapati making", "food_cooking", False, ""),
    ("food_packaging", "Food packaging", "food_cooking", False, ""),
    ("meal_prep", "Meal prep", "food_cooking", False, ""),
    ("cook_for_families", "Cooking in other homes", "food_cooking", False, ""),
    ("laddoo_making", "Laddoo and dry fruit sweets", "food_cooking", False, ""),
    ("juice_stall", "Juice and drinks", "food_cooking", False, ""),
    ("street_food", "Street food stall", "food_cooking", False, ""),
    ("cooking_classes", "Cooking classes", "food_cooking", False, "Teaching"),
    # ── teaching & tuition ──────────────────────────────────────────────
    ("home_tuition", "Home tuition", "teaching_tuition", True, ""),
    ("maths_tuition", "Maths tuition", "teaching_tuition", False, ""),
    ("science_tuition", "Science tuition", "teaching_tuition", False, ""),
    ("spoken_english", "Spoken English", "teaching_tuition", False, ""),
    ("hindi_teaching", "Hindi teaching", "teaching_tuition", False, ""),
    ("language_teaching", "Teaching a regional language", "teaching_tuition", False, ""),
    ("primary_teaching", "Primary school teaching", "teaching_tuition", False, ""),
    ("nursery_teaching", "Nursery and pre-school teaching", "teaching_tuition", False, ""),
    ("abacus", "Abacus", "teaching_tuition", False, ""),
    ("phonics", "Phonics", "teaching_tuition", False, ""),
    ("exam_coaching", "Exam coaching", "teaching_tuition", False, ""),
    ("online_tutoring", "Online tutoring", "teaching_tuition", False, ""),
    ("computer_teaching", "Teaching computers", "teaching_tuition", False, ""),
    ("sewing_teaching", "Teaching sewing", "teaching_tuition", False, ""),
    ("craft_teaching", "Teaching crafts", "teaching_tuition", False, ""),
    ("homework_help", "Homework help", "teaching_tuition", False, ""),
    ("adult_literacy", "Adult literacy", "teaching_tuition", False, ""),
    # ── office & digital ────────────────────────────────────────────────
    ("data_entry", "Data entry", "office_digital", True, ""),
    ("typing", "Typing", "office_digital", False, ""),
    ("ms_excel", "MS Excel", "office_digital", False, ""),
    ("ms_word", "MS Word", "office_digital", False, ""),
    ("tally", "Tally", "office_digital", False, ""),
    ("bookkeeping", "Bookkeeping", "office_digital", False, ""),
    ("accounting", "Accounting", "office_digital", False, ""),
    ("gst_filing", "GST filing", "office_digital", False, ""),
    ("content_writing", "Content writing", "office_digital", False, ""),
    ("translation", "Translation", "office_digital", False, ""),
    ("transcription", "Transcription", "office_digital", False, ""),
    ("social_media", "Social media management", "office_digital", False, ""),
    ("graphic_design", "Graphic design", "office_digital", False, ""),
    ("canva", "Canva design", "office_digital", False, ""),
    ("video_editing", "Video editing", "office_digital", False, ""),
    ("photography", "Photography", "office_digital", False, ""),
    ("product_photography", "Product photography", "office_digital", False, ""),
    ("web_design", "Website design", "office_digital", False, ""),
    ("digital_marketing", "Digital marketing", "office_digital", False, ""),
    ("customer_support", "Customer support", "office_digital", False, ""),
    ("telecalling", "Telecalling", "office_digital", False, ""),
    ("virtual_assistant", "Virtual assistant", "office_digital", False, ""),
    ("whatsapp_business", "WhatsApp Business", "office_digital", False, ""),
    ("form_filling", "Online form filling", "office_digital", False, ""),
    ("receptionist", "Receptionist", "office_digital", False, ""),
    ("office_admin", "Office administration", "office_digital", False, ""),
    ("hr_recruiting", "Recruiting and HR", "office_digital", False, ""),
    ("coding", "Coding", "office_digital", False, ""),
    # ── care work ───────────────────────────────────────────────────────
    ("childcare", "Childcare", "care_work", True, ""),
    ("babysitting", "Babysitting", "care_work", False, ""),
    ("nanny", "Nanny", "care_work", False, ""),
    ("day_care", "Running a day care", "care_work", False, ""),
    ("elder_care", "Elder care", "care_work", False, ""),
    ("patient_attendant", "Patient attendant", "care_work", False, ""),
    ("special_needs_care", "Special needs care", "care_work", False, ""),
    ("companion_care", "Companion for the elderly", "care_work", False, ""),
    ("new_mother_care", "Care for new mothers and babies", "care_work", False, ""),
    ("pet_care", "Pet care", "care_work", False, "Other"),
    # ── home services ───────────────────────────────────────────────────
    ("house_cleaning", "House cleaning", "home_services", False, ""),
    ("deep_cleaning", "Deep cleaning", "home_services", False, ""),
    ("laundry_ironing", "Laundry and ironing", "home_services", False, ""),
    ("domestic_help", "Domestic help", "home_services", False, ""),
    ("housekeeping", "Housekeeping", "home_services", False, ""),
    ("organising_homes", "Organising homes", "home_services", False, ""),
    ("kitchen_gardening_service", "Looking after plants and gardens", "home_services", False, "Other"),
    # ── farming & animal care ──────────────────────────────────────────
    ("dairy_farming", "Dairy farming", "farming_animals", False, ""),
    ("poultry", "Poultry", "farming_animals", False, ""),
    ("goat_rearing", "Goat rearing", "farming_animals", False, ""),
    ("kitchen_garden", "Kitchen garden", "farming_animals", False, ""),
    ("organic_farming", "Organic farming", "farming_animals", False, ""),
    ("mushroom_farming", "Mushroom farming", "farming_animals", False, ""),
    ("vermicompost", "Vermicompost", "farming_animals", False, ""),
    ("plant_nursery", "Plant nursery", "farming_animals", False, ""),
    ("beekeeping", "Beekeeping", "farming_animals", False, ""),
    ("fish_farming", "Fish farming", "farming_animals", False, ""),
    ("flower_farming", "Flower farming", "farming_animals", False, ""),
    ("garland_making", "Garland making", "farming_animals", False, ""),
    ("seed_saving", "Seed saving", "farming_animals", False, ""),
    ("food_drying", "Drying and processing produce", "farming_animals", False, ""),
    ("vegetable_selling", "Selling vegetables", "farming_animals", False, ""),
    # ── retail & sales ──────────────────────────────────────────────────
    ("shop_keeping", "Running a shop", "retail_sales", False, ""),
    ("kirana_store", "Kirana store", "retail_sales", False, ""),
    ("saree_selling", "Selling sarees", "retail_sales", False, ""),
    ("cosmetics_selling", "Selling cosmetics", "retail_sales", False, ""),
    ("online_reselling", "Online reselling", "retail_sales", False, ""),
    ("door_to_door_sales", "Door-to-door sales", "retail_sales", False, ""),
    ("insurance_agent", "Insurance agent", "retail_sales", False, ""),
    ("mela_stall", "Stalls at melas and exhibitions", "retail_sales", False, ""),
    ("billing_cashier", "Billing and cashier", "retail_sales", False, ""),
    ("stock_keeping", "Stock keeping", "retail_sales", False, ""),
    ("sales_promoter", "Sales promoter", "retail_sales", False, ""),
    ("garment_selling", "Selling readymade clothes", "retail_sales", False, ""),
    # ── arts & performance ─────────────────────────────────────────────
    ("singing", "Singing", "arts_performance", False, ""),
    ("classical_dance", "Classical dance", "arts_performance", False, ""),
    ("folk_dance", "Folk dance", "arts_performance", False, ""),
    ("painting", "Painting", "arts_performance", False, ""),
    ("drawing", "Drawing and sketching", "arts_performance", False, ""),
    ("calligraphy", "Calligraphy", "arts_performance", False, ""),
    ("storytelling", "Storytelling", "arts_performance", False, ""),
    ("anchoring", "Anchoring and compering", "arts_performance", False, "Other"),
    ("theatre", "Theatre", "arts_performance", False, ""),
    ("musical_instrument", "Playing an instrument", "arts_performance", False, ""),
    ("voice_over", "Voice-over", "arts_performance", False, "Other"),
    ("mural_painting", "Wall murals", "arts_performance", False, "Other"),
    # ── repairs & technical ─────────────────────────────────────────────
    ("mobile_repair", "Mobile phone repair", "repairs_technical", False, ""),
    ("electrician", "Electrical work", "repairs_technical", False, ""),
    ("plumbing", "Plumbing", "repairs_technical", False, ""),
    ("sewing_machine_repair", "Sewing machine repair", "repairs_technical", False, ""),
    ("appliance_repair", "Appliance repair", "repairs_technical", False, ""),
    ("solar_technician", "Solar panel technician", "repairs_technical", False, ""),
    ("carpentry", "Carpentry", "repairs_technical", False, ""),
    ("wall_painting", "House painting", "repairs_technical", False, ""),
    ("driving", "Driving", "repairs_technical", False, "Other"),
    ("two_wheeler_delivery", "Two-wheeler delivery", "repairs_technical", False, "Other"),
    ("e_rickshaw", "E-rickshaw driving", "repairs_technical", False, "Other"),
    # ── community & finance ─────────────────────────────────────────────
    ("shg_bookkeeping", "Self-help group bookkeeping", "community_finance", False, ""),
    ("bank_correspondent", "Banking correspondent", "community_finance", False, ""),
    ("csc_services", "Common service centre work", "community_finance", False, ""),
    ("survey_work", "Survey work", "community_finance", False, ""),
    ("community_mobiliser", "Community mobiliser", "community_finance", False, ""),
    ("anganwadi_helper", "Anganwadi helper", "community_finance", False, ""),
    ("counselling", "Counselling", "community_finance", False, ""),
    ("savings_group", "Running a savings group", "community_finance", False, ""),
    # ── events & hospitality ────────────────────────────────────────────
    ("event_management", "Event management", "events_hospitality", False, ""),
    ("wedding_planning", "Wedding planning", "events_hospitality", False, ""),
    ("flower_decoration", "Flower decoration", "events_hospitality", False, ""),
    ("party_decoration", "Party decoration", "events_hospitality", False, ""),
    ("homestay", "Running a homestay", "events_hospitality", False, ""),
    ("hotel_housekeeping", "Hotel housekeeping", "events_hospitality", False, "Cleaning"),
    ("canteen_cooking", "Canteen and hostel cooking", "events_hospitality", False, "Cooking"),
    ("tour_guide", "Tour guide", "events_hospitality", False, ""),
]


def _build() -> list[dict]:
    out: list[dict] = []
    for key, label, group, popular, category in _RAW:
        out.append({
            "key": key,
            "label": label,
            "group": group,
            "group_label": GROUPS[group][0],
            "service_category": category or GROUPS[group][1],
            "popular": popular,
        })
    return out


SKILLS: list[dict] = _build()
SKILLS_BY_KEY: dict[str, dict] = {s["key"]: s for s in SKILLS}
_BY_LABEL: dict[str, dict] = {s["label"].casefold(): s for s in SKILLS}

#: Groups whose skills make her an artisan, for the member segment.
ARTISAN_GROUPS = {"handicrafts"}


def by_label(text: str) -> dict | None:
    """The taxonomy entry whose label is exactly this text, ignoring case."""
    return _BY_LABEL.get(" ".join((text or "").split()).casefold())


def search(q: str = "", limit: int = 20) -> list[dict]:
    """
    Skills whose label starts with `q`, then those that contain it; popular
    first within each. An empty query returns the popular ones, then the rest
    in taxonomy order — what the picker shows before she types.
    """
    needle = " ".join((q or "").split()).casefold()
    if not needle:
        ranked = sorted(SKILLS, key=lambda s: (not s["popular"],))
        return ranked[:limit]

    def words_start(label: str) -> bool:
        return any(w.startswith(needle) for w in label.split())

    scored: list[tuple[int, bool, int, dict]] = []
    for i, s in enumerate(SKILLS):
        label = s["label"].casefold()
        if label.startswith(needle):
            tier = 0
        elif words_start(label) or s["key"].startswith(needle.replace(" ", "_")):
            tier = 1
        elif needle in label or needle in s["group_label"].casefold():
            tier = 2
        else:
            continue
        scored.append((tier, not s["popular"], i, s))
    scored.sort(key=lambda t: t[:3])
    return [t[3] for t in scored[:limit]]
