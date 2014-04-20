#!/usr/bin/env node

module.exports = function(grunt) {
    var proc = require('child_process');
    var fs        = require('fs');
    var path      = require('path');
    var _         = require('lodash');
    var domparser = require('xmldom').DOMParser;
    var dir = require('node-dir');
    var ArgumentParser = require('argparse').ArgumentParser;
    var SvgPath   = require('svgpath');
    var child_process = require('child_process');

    grunt.registerTask('build', 'build Icon font', function() {
        var done = this.async();
        var svgFontTemplate = _.template(
            '<?xml version="1.0" standalone="no"?>\n' +
            '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
            '<svg xmlns="http://www.w3.org/2000/svg">\n' +
            '<metadata><%= metadata %></metadata>\n' +
            '<defs>\n' +
            '<font id="<%= font.fontname %>" horiz-adv-x="<%= fontHeight %>" >\n' +

            '<font-face' +
              ' font-family="<%= font.familyname %>"' +
              ' font-weight="400"' +
              ' font-stretch="normal"' +
              ' units-per-em="<%= fontHeight %>"' +
              //panose-1="2 0 5 3 0 0 0 0 0 0"
              ' ascent="<%= font.ascent %>"' +
              ' descent="<%= font.descent %>"' +
              //bbox="-1.33333 -150.333 1296 850"
              //underline-thickness="50"
              //underline-position="-100"
              //unicode-range="U+002B-1F6AB"
            ' />\n' +

            '<missing-glyph horiz-adv-x="<%= fontHeight %>" />\n' +

            '<% _.forEach(glyphs, function(glyph) { %>' +
              '<glyph' +
                ' glyph-name="<%= glyph.css %>"' +
                ' unicode="<%= glyph.unicode %>"' +
                ' d="<%= glyph.d %>"' +
                ' horiz-adv-x="<%= glyph.width %>"' +
              ' />\n' +
            '<% }); %>' +

            '</font>\n' +
            '</defs>\n' +
            '</svg>'
        );


        function parseSvgImage(data, filename) {

            var doc = (new domparser()).parseFromString(data, 'application/xml');
            var svg = doc.getElementsByTagName('svg')[0];

            if (!svg.hasAttribute('height')) {
              throw filename ? 'Missed height attribute in ' + filename : 'Missed height attribute';
            }
            if (!svg.hasAttribute('width')) {
              throw filename ? 'Missed width attribute in ' + filename : 'Missed width attribute';
            }

            var height = svg.getAttribute('height');
            var width  = svg.getAttribute('width');

            // Silly strip 'px' at the end, if exists
            height = parseFloat(height);
            width  = parseFloat(width);

            var path = svg.getElementsByTagName('path');

            if (path.length > 1) {
                throw 'Multiple paths not supported' + (filename ? ' (' + filename + ' ' : '');
            }
            if (path.length === 0) {
                throw 'No path data fount' + (filename ? ' (' + filename + ' ' : '');
            }

            path = path[0];

            var d = path.getAttribute('d');

            var transform = '';

            if (path.hasAttribute('transform')) {
              transform = path.getAttribute('transform');
            }

            return {
              height    : height,
              width     : width,
              d         : d,
              transform : transform
            };
        }

        // server config, to build svg fonts
        // contains uid hash + svg paths, to generate font quickly
        var svgs = [];

        // Counter
        var internalCode = 0xF000;
        ////////////////////////////////////////////////////////////////////////////////

        //
        // Scan sources
        //
        var args = {input_fonts: './src/svg/', output: 'build/icon.svg'};
        grunt.file.recurse(args.input_fonts, function (abspath, rootdir, subdir, file_name) { 
                var glyph_data = {};
                glyph_data.charRef = internalCode;
                internalCode++;
                glyph_data.css = file_name;
                glyph_data.svg = {};
                var svg = parseSvgImage(fs.readFileSync(abspath, 'utf8'), file_name);
                var scale = 1000 / svg.height;
                glyph_data.svg.width = +(svg.width * scale).toFixed(1);
                glyph_data.svg.d = new SvgPath(svg.d)
                                        .scale(scale)
                                        .abs().round(1).rel()
                                        .toString();
                svgs.push(_.clone(glyph_data, true));
            }
        );
        var font = {
            fontname: 'w3iconfont',
            familyname: 'w3iconfont',
            ascent: 850,
            descent: -150
        };

        var glyphs = [];
        _.forEach(svgs, function (glyph) {
            glyphs.push({
                heigh : glyph.svg.height,
                width : glyph.svg.width,
                d     : new SvgPath(glyph.svg.d)
                              .scale(1, -1)
                              .translate(0, 850)
                              .abs().round(0).rel()
                              .toString(),
                css   : glyph.css,
                unicode : '&#x' + glyph.charRef.toString(16) + ';'
            });
        });

        var svgOut = svgFontTemplate({
            font : font,
            glyphs : glyphs,
            metadata: 'internal font for meituan.com website',
            fontHeight : font.ascent - font.descent
        });
        fs.writeFileSync(args.output, svgOut, 'utf8');
        console.log('svg2ttf begin');
        child_process.exec('./node_modules/.bin/svg2ttf build/icon.svg build/icon.ttf', function () {
                console.log('ttf complete');
                child_process.exec('./node_modules/.bin/ttf2woff build/icon.ttf build/icon.woff', function () {
                    console.log('woff complete'); 
                    child_process.exec('./node_modules/.bin/ttf2eot build/icon.ttf build/icon.eot', function () {
                        console.log('eot complete');
                        done(true);
                    }); 
                }); 
        }); 
    });
};
