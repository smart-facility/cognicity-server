#!/bin/bash

# Script
# © Matthew Berryman 2014

# 1st command line parameter = base name for web instances.
# 2nd command line parameter = number of web instances

# Set this to the list of files to be synced:
FILES=test

# Note assume nodes start from 1, and that the files are on node 1 and we
# want to sync from there to other nodes

i=2
while [ $i -lt $2 ]; do
    rsync -av FILES $1$i
    let i=i+1
done



