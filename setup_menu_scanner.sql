-- ============================================================
-- SQL Migration: Setup AI Menu Card Scanner Function (UPDATED)
-- Paste this script in your Supabase SQL Editor and click RUN.
-- ============================================================

-- 1. Enable the HTTP extension (required to make API calls from Postgres)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. Create the secure scan function (updated to use gemini-2.5-flash)
CREATE OR REPLACE FUNCTION public.scan_menu_card(image_base64 text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_key text := 'YOUR_GEMINI_API_KEY_HERE'; -- REPLACE THIS WITH YOUR GEMINI API KEY
  response extensions.http_response;
  payload json;
  result json;
BEGIN
  -- Construct the payload for Gemini API
  payload := json_build_object(
    'contents', json_build_array(
      json_build_object(
        'parts', json_build_array(
          json_build_object(
            'text', 'Analyze this menu card image and extract all food items. For each item, extract the name, category (e.g. Starter, Main Course, Biryani, Soups, Dessert, Beverage, Tiffin, Bread), price (numeric value only, omit currency symbols), and whether it is vegetarian (true/false) based on standard ingredients or indicators (like green dot/red dot). Return the result as a raw JSON array of objects with the keys: name, category, price, is_veg. Return ONLY the raw JSON array. Do not include markdown code block formatting (like ```json ... ```) or any other conversational text.'
          ),
          json_build_object(
            'inlineData', json_build_object(
              'mimeType', 'image/jpeg',
              'data', image_base64
            )
          )
        )
      )
    )
  );

  -- Make the HTTP request to Gemini API (using gemini-2.5-flash)
  response := extensions.http_post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' || api_key,
    payload::text,
    'application/json'
  );

  -- Parse and return response
  IF response.status = 200 THEN
    result := response.content::json;
    RETURN result;
  ELSE
    RAISE EXCEPTION 'Gemini API call failed with status %: %', response.status, response.content;
  END IF;
END;
$$;
