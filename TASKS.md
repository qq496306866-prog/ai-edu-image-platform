# Development Tasks

## Phase 1: Project Skeleton

- [ ] Create monorepo
- [ ] Add frontend Next.js app
- [ ] Add backend FastAPI app
- [ ] Add PostgreSQL
- [ ] Add Redis
- [ ] Add Celery worker
- [ ] Add docker-compose.yml
- [ ] Add GET /health
- [ ] Add README.md

## Phase 2: Auth

- [ ] User registration
- [ ] User login
- [ ] JWT auth
- [ ] Password hashing with bcrypt
- [ ] GET /api/me
- [ ] Frontend login page
- [ ] Frontend register page
- [ ] Token storage
- [ ] Authenticated dashboard

## Phase 3: Excel Upload

- [ ] Upload .xlsx
- [ ] Limit file size to 20MB
- [ ] Parse first sheet with openpyxl
- [ ] Auto-detect title/prompt/reference image columns
- [ ] Create generation_job
- [ ] Create generation_items
- [ ] Return preview first 10 rows
- [ ] Frontend upload UI
- [ ] Frontend parse preview

## Phase 4: Job Center

- [ ] GET /api/jobs
- [ ] GET /api/jobs/{job_id}
- [ ] GET /api/jobs/{job_id}/items
- [ ] Dashboard task list
- [ ] Job detail page
- [ ] Item status display
- [ ] Manual refresh

## Phase 5: Mock Image Generation

- [ ] Implement ImageGenerationProvider interface
- [ ] Implement MockImageGenerationProvider
- [ ] POST /api/jobs/{job_id}/start
- [ ] Submit Celery task
- [ ] Worker processes pending items
- [ ] Generate placeholder images with Pillow
- [ ] Save images to storage/generated
- [ ] Update item status
- [ ] Update job status
- [ ] Support cancellation

## Phase 6: Preview and ZIP Download

- [ ] Static media route
- [ ] Image thumbnails
- [ ] Image preview modal
- [ ] GET /api/jobs/{job_id}/download-zip
- [ ] Safe ZIP filename handling
- [ ] Download ZIP button

## Phase 7: Credits

- [ ] Add user_credits table
- [ ] Add credit_transactions table
- [ ] Give new users 20 credits
- [ ] Deduct 1 credit per image
- [ ] Refund credit on generation failure
- [ ] Prevent starting job when credits are insufficient
- [ ] Show credit balance on dashboard

## Phase 8: Real Image API

- [ ] Add RealImageGenerationProvider
- [ ] Read IMAGE_API_BASE_URL from env
- [ ] Read IMAGE_API_KEY from env
- [ ] Read IMAGE_MODEL from env
- [ ] Use httpx
- [ ] Add timeout and retry
- [ ] Keep mock provider available
- [ ] Switch provider by IMAGE_PROVIDER
