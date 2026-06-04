import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// assets/ live at the project root, exposed to Remotion via public/ (symlink).
Config.setPublicDir("public");
