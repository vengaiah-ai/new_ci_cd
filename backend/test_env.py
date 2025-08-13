import os
print("Environment Variables:")
print(f"GROQ_API_KEY: {'*' * 10 + os.getenv('GROQ_API_KEY', 'NOT FOUND')[-4:] if os.getenv('GROQ_API_KEY') else 'NOT FOUND'}")
print(f"Current working directory: {os.getcwd()}")
print(f"Files in directory: {os.listdir('.')}")
print(f"Parent directory: {os.path.dirname(os.getcwd())}")
print(f"Files in parent directory: {os.listdir(os.path.dirname(os.getcwd()))}")
