
import sys
import g4f
import asyncio

# Set event loop policy for Windows if needed, though running on Mac
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def main():
    if len(sys.argv) < 2:
        print("Error: No prompt provided")
        sys.exit(1)

    prompt = sys.argv[1]

    try:
        # G4F usage may vary by version. Attempting standard async compat.
        # Fallback to sync if async fails or differs.
        
        # Using automatic provider selection
        response = await g4f.ChatCompletion.create_async(
            model=g4f.models.default,
            messages=[{"role": "user", "content": prompt}],
        )
        
        # Clean response if needed
        print("---G4F_RESPONSE---")
        print(response)

    except Exception as e:
        # Check if it might be a sync call in installed version
        try:
            response = g4f.ChatCompletion.create(
                model=g4f.models.default,
                messages=[{"role": "user", "content": prompt}],
            )
            print("---G4F_RESPONSE---")
            print(response)
        except Exception as e2:
             print(f"Error: {str(e)} | Backup Error: {str(e2)}", file=sys.stderr)
             sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
