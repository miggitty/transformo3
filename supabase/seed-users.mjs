import { createClient } from '@supabase/supabase-js';

// --- 1. DEFINE YOUR TEST USERS AND PROFILE DATA ---
const users = [
  {
    email: 'marlon@enzango.com',
    password: 'samson',
    profile: {
      first_name: 'Marlon',
      last_name: 'Marescia',
      is_admin: false,
      business_name: 'Enzango',
    },
  },
  {
    email: 'marlonmarescia@gmail.com',
    password: 'samson',
    profile: {
      first_name: 'Miggitty',
      last_name: 'Marl',
      is_admin: true,
      business_name: 'Transformo',
    },
  },
];

// --- 2. GET LOCAL SUPABASE CONNECTION DETAILS ---
const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'; // Default local key from `supabase start`

// --- 3. CREATE THE ADMIN CLIENT ---
const supabaseAdmin = createClient(supabaseUrl, service_role_key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// --- 4. THE SEEDING FUNCTION ---
async function seedData() {
  console.log('🌱 Seeding data...');

  for (const userData of users) {
    let user;
    // Create user in auth.users
    console.log(`Creating user: ${userData.email}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Auto-confirm user's email
    });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        console.log(`User ${userData.email} already exists, fetching...`);
        // If user exists, we need to fetch their data to get the ID
        const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          console.error(`❌ Error fetching users:`, listError.message);
          continue; // Skip to next user
        }
        user = allUsers.find(u => u.email === userData.email);
        if (!user) {
          console.error(`❌ Could not find existing user ${userData.email} after listing all users.`);
          continue;
        }
        console.log(`Found existing user: ${user.email}`);
      } else {
        console.error(`❌ Error creating user ${userData.email}:`, authError.message);
        continue; // Skip to the next user
      }
    } else {
      user = authData.user;
      console.log(`✅ Successfully created user: ${user.email}`);
    }

    const userId = user.id;
    console.log(`Retrieved user ID: ${userId}`);

    // Create or find the business
    const businessName = userData.profile.business_name;
    let { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('business_name', businessName)
      .single();

    if (businessError && businessError.code !== 'PGRST116') { // PGRST1116 = 'No rows found' in PostgREST
      console.error(`❌ Error checking for business ${businessName}:`, businessError.message);
      continue;
    }

    if (!business) {
      console.log(`🏢 Business "${businessName}" not found, creating it...`);
      const { data: newBusiness, error: newBusinessError } = await supabaseAdmin
        .from('businesses')
        .insert({ business_name: businessName })
        .select('id')
        .single();
      
      if (newBusinessError) {
        console.error(`❌ Error creating business ${businessName}:`, newBusinessError.message);
        continue;
      }
      business = newBusiness;
      console.log(`✅ Successfully created business: ${businessName}`);
    } else {
        console.log(`🏢 Business "${businessName}" already exists.`);
    }

    const businessId = business.id;

    // Create the user's profile
    console.log(`Creating profile for ${userData.email}...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        first_name: userData.profile.first_name,
        last_name: userData.profile.last_name,
        is_admin: userData.profile.is_admin,
        business_id: businessId,
      });

    if (profileError) {
      console.error(`❌ Error creating profile for ${userData.email}:`, profileError.message);
    } else {
      console.log(`✅ Successfully created profile for ${userData.email}`);
    }
  }

  console.log('Finished seeding data.');
}

seedData(); 