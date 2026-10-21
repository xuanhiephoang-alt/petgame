@echo off
rem Bam dup vao file nay de cai che do AI cua photo3d (Hunyuan3D-2mv).
rem Double-click to set up the AI shapes of photo3d; see tools\photo3d\README.md.
cd /d "%~dp0"
call npm.cmd run photo3d:ai-setup
echo.
pause
