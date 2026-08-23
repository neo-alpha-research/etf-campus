import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// Usage: node scripts/seed-community-posts.mjs [--dry-run]
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in environment variables.
// You can load them by running: `$env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/seed-community-posts.mjs`

const SEED_DIR = path.join(process.cwd(), "content", "seeds");

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isDryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
    process.exit(1);
  }

  try {
    const files = await fs.readdir(SEED_DIR);
    const mdFiles = files.filter(f => f.endsWith(".md"));
    
    const seeds = [];
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(SEED_DIR, file), "utf8");
      const parsed = matter(content);
      
      const dayNumber = parsed.data.day_number ?? 999;
      seeds.push({
        file,
        dayNumber,
        title: parsed.data.title,
        categorySlug: parsed.data.category_slug,
        isAuthorSeed: parsed.data.is_author_seed === true,
        isPinned: parsed.data.is_pinned === true,
        bodyText: parsed.content.trim(),
        authorEmail: parsed.data.author_email || "admin@etfcampus.com" // Admin user email to own the post
      });
    }

    seeds.sort((a, b) => a.dayNumber - b.dayNumber);

    if (seeds.length === 0) {
      console.log("No seed files found in", SEED_DIR);
      return;
    }

    console.log(`Found ${seeds.length} seed files. Starting processing...`);

    let adminUserId = null;
    let adminProfileId = null;

    if (!isDryRun) {
      // Get Admin User ID using the service role key
      const adminEmail = seeds[0].authorEmail; // Assume the first seed's email is the admin email
      
      // Get the user ID from auth.users (via admin API)
      const userListRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        }
      });
      
      if (userListRes.ok) {
        const users = await userListRes.json();
        const adminUser = users.users ? users.users.find(u => u.email === adminEmail) : users.find(u => u.email === adminEmail);
        
        if (adminUser) {
          adminUserId = adminUser.id;
          
          // Ensure profile exists for this user in public.user_profiles
          const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${adminUserId}&select=id`, {
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
            }
          });
          const profiles = await profileRes.json();
          if (profiles && profiles.length > 0) {
            adminProfileId = profiles[0].id;
          } else {
            console.error(`User profile not found for admin user ${adminEmail}. Run bootstrap on this user first.`);
            process.exit(1);
          }
        } else {
          console.error(`Admin user ${adminEmail} not found in Supabase Auth. Please create the user first.`);
          process.exit(1);
        }
      } else {
        console.error("Failed to fetch users", await userListRes.text());
        process.exit(1);
      }
    }

    for (const seed of seeds) {
      console.log(`\nProcessing: [Day ${seed.dayNumber}] ${seed.title}`);
      
      if (!seed.title || !seed.categorySlug || !seed.bodyText) {
        console.error(`  -> Skipped: Missing required fields (title, category_slug, or body content) in ${seed.file}`);
        continue;
      }

      if (isDryRun) {
        console.log(`  -> (Dry Run) Would create post in '${seed.categorySlug}' with title '${seed.title}'`);
        continue;
      }

      // Check if post already exists
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/community_posts?title=eq.${encodeURIComponent(seed.title)}&select=id`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        }
      });
      
      if (!checkRes.ok) {
        console.error(`  -> Failed to check existing post:`, await checkRes.text());
        continue;
      }

      const existing = await checkRes.json();
      if (existing.length > 0) {
        console.log(`  -> Skipped: Post already exists with this title`);
        continue;
      }

      // Fetch category ID
      const catRes = await fetch(`${supabaseUrl}/rest/v1/community_categories?slug=eq.${seed.categorySlug}&select=id`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        }
      });
      const categories = await catRes.json();
      
      if (!categories || categories.length === 0) {
        console.error(`  -> Failed: Category '${seed.categorySlug}' not found.`);
        continue;
      }
      
      const categoryId = categories[0].id;

      // Insert post
      const insertPayload = {
        category_id: categoryId,
        author_profile_id: adminProfileId,
        title: seed.title,
        body_text: seed.bodyText,
        is_author_seed: seed.isAuthorSeed,
        is_pinned: seed.isPinned,
        pinned_at: seed.isPinned ? new Date().toISOString() : null,
        pinned_by: seed.isPinned ? adminProfileId : null,
      };

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/community_posts`, {
        method: 'POST',
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(insertPayload)
      });

      if (insertRes.ok) {
        console.log(`  -> Success: Post created.`);
      } else {
        console.error(`  -> Failed to create post:`, await insertRes.text());
      }
    }
    
    console.log("\nDone.");

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Seed directory not found at ${SEED_DIR}`);
      console.error("Please create 'content/seeds' directory and add markdown files.");
    } else {
      console.error("Error:", error);
    }
  }
}

run();
