@echo off
echo ===================================================
echo GabinoTech OS - Submit Bounty PR for Issue #32
echo Destination Payout: gabinotech22@gmail.com
echo ===================================================
git push origin fix/bounty-issue-1
gh pr create --title "Add React Native support" --body-file PR_CLAIM_BUNDLE.md
echo [OK] Pull Request submitted. Check https://github.com/prasenjeet-symon/shipli-ai/issues/1
pause
