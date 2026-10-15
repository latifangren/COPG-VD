#!/system/bin/sh

copgvd_json_active_value() {
    config_file="$1"
    config_key="$2"
    [ -f "$config_file" ] || return 1
    awk -v object='COPG-VD' -v wanted="$config_key" '
        function skip_space(    c) {
            while (pos <= length(text)) {
                c = substr(text, pos, 1)
                if (c != " " && c != "\t" && c != "\r" && c != "\n") break
                pos++
            }
        }
        function read_string(    c, nextc, result) {
            result = ""
            pos++
            while (pos <= length(text)) {
                c = substr(text, pos, 1)
                pos++
                if (c == "\"") break
                if (c == "\\" && pos <= length(text)) {
                    nextc = substr(text, pos, 1)
                    pos++
                    if (nextc == "n") result = result "\n"
                    else if (nextc == "r") result = result "\r"
                    else if (nextc == "t") result = result "\t"
                    else result = result nextc
                } else result = result c
            }
            return result
        }
        {
            text = text $0 "\n"
        }
        END {
            depth = 0
            target_depth = 0
            pos = 1
            while (pos <= length(text)) {
                skip_space()
                if (pos > length(text)) break
                c = substr(text, pos, 1)
                if (c == "\"") {
                    value = read_string()
                    skip_space()
                    if (substr(text, pos, 1) == ":") {
                        object_key[depth] = value
                        pos++
                    } else if (target_depth > 0 && depth == target_depth && object_key[depth] == wanted) {
                        print value
                        exit
                    }
                } else if (c == "{") {
                    if (depth == 1 && object_key[depth] == object) target_depth = depth + 1
                    depth++
                    pos++
                } else if (c == "}") {
                    if (depth == target_depth) target_depth = 0
                    delete object_key[depth]
                    depth--
                    pos++
                } else pos++
            }
        }
    ' "$config_file"
}
