#!/bin/bash
set -eu
DIR=$1
TMP=tmp
#mkdir $TMP
#mv "$DIR/download" `printf $TMP/frame_%03d.png 0`
#for i in {1..41}
#do
#     mv "$DIR/download ($i)" `printf $TMP/frame_%03d.png $i`
#done
convert -delay 05 -loop 0 $TMP/*.png out.gif
#rm -rf tmp