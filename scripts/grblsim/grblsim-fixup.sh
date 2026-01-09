#!/bin/bash
# Apply build fixes to grbl-sim (repeatable process)
# This script patches the cloned grbl-sim code to work with the current grbl version

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
GRBL_SIM_DIR="${PROJECT_ROOT}/examples/grbl-sim-build/grbl/grbl-sim"
MAKEFILE="${GRBL_SIM_DIR}/Makefile"

# Check if cloned
if [ ! -d "$GRBL_SIM_DIR" ] || [ ! -d "$GRBL_SIM_DIR/.git" ]; then
    echo "❌ Error: grbl-sim not found at $GRBL_SIM_DIR"
    echo "   Run 'scripts/grblsim/grblsim-clone.sh' first"
    exit 1
fi

echo "🔧 Applying build fixes to grbl-sim..."

cd "$GRBL_SIM_DIR"

# Files to patch (backup before modifying)
FILES_TO_PATCH=("$MAKEFILE" "config.h" "grbl_interface.c" "validator.c" "avr/eeprom.h" "planner_inject_accessors.c" "serial.c")
for file in "${FILES_TO_PATCH[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "${file}.bak" 2>/dev/null || true
    fi
done

# Fix 1: Makefile - Update paths and add include directory
if [ -f "$MAKEFILE" ]; then
    echo "   Fixing Makefile paths..."
    
    # Fix object file paths: ../*.o -> ../grbl/*.o
    sed -i 's|../protocol\.o|../grbl/protocol.o|g' "$MAKEFILE"
    sed -i 's|../planner\.o|../grbl/planner.o|g' "$MAKEFILE"
    sed -i 's|../settings\.o|../grbl/settings.o|g' "$MAKEFILE"
    sed -i 's|../print\.o|../grbl/print.o|g' "$MAKEFILE"
    sed -i 's|../nuts_bolts\.o|../grbl/nuts_bolts.o|g' "$MAKEFILE"
    sed -i 's|../stepper\.o|../grbl/stepper.o|g' "$MAKEFILE"
    sed -i 's|../gcode\.o|../grbl/gcode.o|g' "$MAKEFILE"
    sed -i 's|../spindle_control\.o|../grbl/spindle_control.o|g' "$MAKEFILE"
    sed -i 's|../motion_control\.o|../grbl/motion_control.o|g' "$MAKEFILE"
    sed -i 's|../limits\.o|../grbl/limits.o|g' "$MAKEFILE"
    sed -i 's|../coolant_control\.o|../grbl/coolant_control.o|g' "$MAKEFILE"
    sed -i 's|../probe\.o|../grbl/probe.o|g' "$MAKEFILE"
    sed -i 's|../system\.o|../grbl/system.o|g' "$MAKEFILE"
    sed -i 's|../main\.o|../grbl/main.o|g' "$MAKEFILE"
    
    # Remove jog.o if it exists (jog.c was removed in newer grbl versions)
    # Remove it from GRBL_BASE_OBJECTS line - handle both ../jog.o and ../grbl/jog.o
    # Do this after path conversions so we catch both patterns
    # Use a more robust pattern that handles any whitespace
    sed -i 's|[[:space:]]*\.\./jog\.o[[:space:]]*||g' "$MAKEFILE"
    sed -i 's|[[:space:]]*\.\./grbl/jog\.o[[:space:]]*||g' "$MAKEFILE"
    sed -i 's|../serial\.o|../grbl/serial.o|g' "$MAKEFILE"
    sed -i 's|../report\.o|../grbl/report.o|g' "$MAKEFILE"
    
    # Fix source file paths in rules: ../*.c -> ../grbl/*.c
    sed -i 's|../planner\.c|../grbl/planner.c|g' "$MAKEFILE"
    sed -i 's|../serial\.c|../grbl/serial.c|g' "$MAKEFILE"
    sed -i 's|../main\.c|../grbl/main.c|g' "$MAKEFILE"
    sed -i 's|../report\.c|../grbl/report.c|g' "$MAKEFILE"
    
    # Add -I../grbl to COMPILE line if not already present
    if ! grep -q "COMPILE.*-I../grbl" "$MAKEFILE"; then
        sed -i 's|\(COMPILE.*-I\.\)|\1 -I../grbl|' "$MAKEFILE"
    fi
fi

# Fix 2: config.h - Update include path
if [ -f "config.h" ]; then
    echo "   Fixing config.h include path..."
    sed -i 's|#include "../system.h"|#include "../grbl/system.h"|' "config.h"
fi

# Fix 3: grbl_interface.c - Fix includes, sys_position, and add SPINDLE guard
if [ -f "grbl_interface.c" ]; then
    echo "   Fixing grbl_interface.c..."
    
    # Fix include paths
    sed -i 's|#include "../system.h"|#include "../grbl/system.h"|' "grbl_interface.c"
    sed -i 's|#include "../planner.h"|#include "../grbl/planner.h"|' "grbl_interface.c"
    sed -i 's|#include "../settings.h"|#include "../grbl/settings.h"|' "grbl_interface.c"
    
    # Add missing includes if not present (after settings.h line)
    if ! grep -q '#include "../grbl/limits.h"' "grbl_interface.c"; then
        # Use awk to insert lines after the settings.h include
        awk '/#include "\.\.\/grbl\/settings\.h"/ { print; print "#include \"../grbl/limits.h\""; print "#include \"../grbl/gcode.h\""; print "#include \"avr/io.h\""; next }1' "grbl_interface.c" > "grbl_interface.c.tmp" && mv "grbl_interface.c.tmp" "grbl_interface.c"
    fi
    
    # Fix sys_position -> sys.position (if not already fixed)
    sed -i 's/sys_position\[/sys.position[/g' "grbl_interface.c"
    
    # Add #ifdef SPINDLE_TCCRA_REGISTER guard if not present
    # Wrap the SPINDLE_TCCRA_REGISTER line with #ifdef ... #endif
    if grep -q "SPINDLE_TCCRA_REGISTER >= 127" "grbl_interface.c" && ! grep -q "#ifdef SPINDLE_TCCRA_REGISTER" "grbl_interface.c"; then
        # Use perl for multi-line replacement
        if perl -i -pe 's|^  if\(SPINDLE_TCCRA_REGISTER >= 127\) ocr = SPINDLE_OCR_REGISTER;|  #ifdef SPINDLE_TCCRA_REGISTER\n  if(SPINDLE_TCCRA_REGISTER >= 127) ocr = SPINDLE_OCR_REGISTER;\n  #endif|' "grbl_interface.c" 2>/dev/null; then
            # Perl succeeded, check if replacement happened
            if ! grep -q "#ifdef SPINDLE_TCCRA_REGISTER" "grbl_interface.c"; then
                # Perl didn't match, try awk fallback
                awk '/^  if\(SPINDLE_TCCRA_REGISTER >= 127\) ocr = SPINDLE_OCR_REGISTER;/ { print "  #ifdef SPINDLE_TCCRA_REGISTER"; print; print "  #endif"; next }1' "grbl_interface.c" > "grbl_interface.c.tmp3"
                if [ -f "grbl_interface.c.tmp3" ]; then
                    mv "grbl_interface.c.tmp3" "grbl_interface.c"
                fi
            fi
        else
            # Perl failed, try awk fallback
            awk '/^  if\(SPINDLE_TCCRA_REGISTER >= 127\) ocr = SPINDLE_OCR_REGISTER;/ { print "  #ifdef SPINDLE_TCCRA_REGISTER"; print; print "  #endif"; next }1' "grbl_interface.c" > "grbl_interface.c.tmp3"
            if [ -f "grbl_interface.c.tmp3" ]; then
                mv "grbl_interface.c.tmp3" "grbl_interface.c"
            fi
        fi
    fi
fi

# Fix 4: validator.c - Update include paths
if [ -f "validator.c" ]; then
    echo "   Fixing validator.c include paths..."
    # Fix each include individually for reliability
    sed -i 's|#include "../nuts_bolts.h"|#include "../grbl/nuts_bolts.h"|g' "validator.c"
    sed -i 's|#include "../settings.h"|#include "../grbl/settings.h"|g' "validator.c"
    sed -i 's|#include "../protocol.h"|#include "../grbl/protocol.h"|g' "validator.c"
    sed -i 's|#include "../report.h"|#include "../grbl/report.h"|g' "validator.c"
    sed -i 's|#include "../system.h"|#include "../grbl/system.h"|g' "validator.c"
    sed -i 's|#include "../gcode.h"|#include "../grbl/gcode.h"|g' "validator.c"
    sed -i 's|#include "../planner.h"|#include "../grbl/planner.h"|g' "validator.c"
    sed -i 's|#include "../serial.h"|#include "../grbl/serial.h"|g' "validator.c"
fi

# Fix 5: avr/eeprom.h - Update include path
if [ -f "avr/eeprom.h" ]; then
    echo "   Fixing avr/eeprom.h include path..."
    sed -i 's|#include "../eeprom.h"|#include "../grbl/eeprom.h"|' "avr/eeprom.h"
fi

# Fix 6: planner_inject_accessors.c - Update include path
if [ -f "planner_inject_accessors.c" ]; then
    echo "   Fixing planner_inject_accessors.c include path..."
    sed -i 's|#include "../planner.h"|#include "../grbl/planner.h"|' "planner_inject_accessors.c"
fi

# Fix 7: serial.c - Update include path
if [ -f "serial.c" ]; then
    echo "   Fixing serial.c include path..."
    sed -i 's|#include "../serial.h"|#include "../grbl/serial.h"|' "serial.c"
fi

echo "✅ Build fixes applied successfully"
echo "   (Backups saved as *.bak files)"
