Your task is to deploy the software to an rpi.  You can build a debug version of the software with:
```yarn build:server-deb-debug-arm64```

Note that will bump the version number so read the output to learn the name of the resulting deb file.

SCP that file to the rpi:
```scp output/nextcnc-server_<version>-debug_arm64.deb ryan@cnc.home:~/```

Then use ssh to run commands on the rpi:
- remove the old version ```sudo dpkg -r nextcnc-server```
- install the new version ```sudo dpkg -i nextcnc-server_<version>-debug_arm64.deb```
- stop.  do not start the server yourself.
