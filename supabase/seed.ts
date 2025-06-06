import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase URL or Service Role Key is missing from .env.local file");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const usersToSeed = [
  {
    email: 'marlonmarescia@gmail.com',
    password: 'samson',
    is_admin: true,
  },
  {
    email: 'marlon@enzango.com',
    password: 'samson',
    is_admin: false,
  },
];

const seedAll = async () => {
  console.log('--- Starting database seed process ---');

  // 1. Create Auth Users
  console.log('Step 1: Creating authentication users...');
  const createdUsers = [];
  for (const user of usersToSeed) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        console.warn(`- User ${user.email} already exists. Fetching existing user.`);
        const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();

        if (getUserError) {
          console.error(`- FAILED to list users:`, getUserError.message);
          continue;
        }

        const existingUser = users.find(u => u.email === user.email);

        if (!existingUser) {
            console.error(`- FAILED to fetch existing user ${user.email}: User not found in list.`);
            continue;
        }
        createdUsers.push({ ...existingUser, is_admin: user.is_admin });
      } else {
        console.error(`- FAILED to create user ${user.email}:`, error.message);
      }
    } else {
      console.log(`- Successfully created user: ${data.user?.email}`);
      createdUsers.push({ ...data.user, is_admin: user.is_admin });
    }
  }
  console.log('Step 1: Finished.');


  // 2. The `handle_new_user` trigger already creates a business and profile.
  // We just need to update them with the correct names and admin status.
  console.log('\nStep 2: Updating profiles and businesses...');
  for (const user of createdUsers) {
    const businessName = user.is_admin ? 'Admin Business' : 'Enzango';
    
    // Update profile with admin status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: user.is_admin })
      .eq('id', user.id);
    
    if (profileError) {
        console.error(`- FAILED to update profile for ${user.email}:`, profileError.message);
    } else {
        console.log(`- Successfully updated profile for ${user.email}`);
    }

    // Get the business_id from the user's profile
    const { data: profileData, error: getProfileError } = await supabaseAdmin
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
    
    if(getProfileError || !profileData?.business_id) {
        console.error(`- FAILED to retrieve business_id for ${user.email}:`, getProfileError?.message || 'Not found');
        continue;
    }

    // Update the auto-created business with the correct name
    const { error: businessError } = await supabaseAdmin
        .from('businesses')
        .update({ name: businessName, contact_email: user.email })
        .eq('id', profileData.business_id);

    if (businessError) {
        console.error(`- FAILED to update business name for ${user.email}:`, businessError.message);
    } else {
        console.log(`- Successfully updated business name for ${user.email} to "${businessName}"`);
    }
  }
  console.log('Step 2: Finished.');
  console.log('\n--- Database seed process complete! ---');
};

seedAll(); 