@echo off
rem Bam dup vao file nay de mo trang web cua photo3d; giu cua so nay mo trong luc dung.
rem Double-click to open the photo3d web page; keep this window open while you use it.
cd /d "%~dp0"
call npm.cmd run photo3d:web
pause
