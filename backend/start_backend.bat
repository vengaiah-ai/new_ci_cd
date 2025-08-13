@echo off
setlocal

:: Set environment variables from the root .env file
for /f "tokens=*" %%i in ('type ..\.env') do (
    set "%%i"
)

:: Start the backend server
uvicorn api:app --reload --port 3001
