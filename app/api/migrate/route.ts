import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

// This route should be secured and only called by authorized users
export async function POST(request: NextRequest) {
  try {
    // Check for authorization (you should implement proper auth)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.MIGRATION_SECRET_TOKEN
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Read migration files from the migrations directory
    const migrationsPath = join(process.cwd(), 'supabase', 'migrations')
    
    try {
      const migrationFiles = await readdir(migrationsPath)
      const sqlFiles = migrationFiles.filter(file => file.endsWith('.sql')).sort()

      // Check which migrations have already been applied
      const { data: appliedMigrations } = await supabase
        .from('schema_migrations')
        .select('version')
      
      const appliedVersions = new Set(appliedMigrations?.map(m => m.version) || [])

      const results = []

      for (const file of sqlFiles) {
        const version = file.replace('.sql', '')
        
        if (appliedVersions.has(version)) {
          results.push({ file, status: 'already_applied' })
          continue
        }

        try {
          const migrationContent = await readFile(join(migrationsPath, file), 'utf-8')
          
          // Execute the migration
          const { error } = await supabase.rpc('exec_sql', { sql: migrationContent })
          
          if (error) {
            throw error
          }

          // Record this migration as applied
          await supabase
            .from('schema_migrations')
            .insert({ version, applied_at: new Date().toISOString() })

          results.push({ file, status: 'applied' })
        } catch (error) {
          results.push({ file, status: 'failed', error: (error as Error).message })
        }
      }

      return NextResponse.json({ 
        success: true, 
        migrations: results 
      })

    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to read migrations directory',
        details: (error as Error).message 
      }, { status: 500 })
    }

  } catch (error) {
    return NextResponse.json({ 
      error: 'Migration failed',
      details: (error as Error).message 
    }, { status: 500 })
  }
} 