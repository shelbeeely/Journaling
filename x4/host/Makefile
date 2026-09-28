# Host preview build: the same app, canvas and data code as the device, with a file/PBM HAL.
SRC = ../src/app.cpp ../src/core/canvas.cpp ../src/core/data.cpp ../src/gen/assets.cpp ../src/lib/qrcodegen.cpp hal_host.cpp
kw_host: $(SRC) $(wildcard ../src/*.h ../src/core/*.h ../src/hal/*.h)
	g++ -std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation -o $@ $(SRC)
