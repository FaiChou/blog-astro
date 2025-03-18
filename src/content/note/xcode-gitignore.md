---
title: Xcode Project gitignore file
description: Xcode Project gitignore file
publishDate: "2025-03-18T11:23:00Z"
---

```
xcuserdata/
*.xcodeproj/*
!*.xcodeproj/project.pbxproj
!*.xcodeproj/xcshareddata/
!*.xcodeproj/project.xcworkspace/
!*.xcworkspace/contents.xcworkspacedata
/*.gcno
**/xcshareddata/WorkspaceSettings.xcsettings

# xcode-build-server config -project *.xcodeproj -scheme ProjectName
buildServer.json
```
