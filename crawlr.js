#!/usr/bin/env node

var request = require('request');
var async = require('async');
var urlUtil = require('url');
var domain = process.argv[2];
var verbose = process.argv[3] == '-v';
var domainObj = urlUtil.parse(domain);
var linkPattern = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gmi;
var titlePattern = /<\s*title[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i;
var traversed = {};
var sitemap = {};

function traversePage(url, page, cb) {
    if (verbose) console.log('CRAWLING PAGE: ' + url);
    page.url = url;
    request.get(url, function (err, response) {
        if (err) return cb();
        var html = response.body;
        page.title = getTitle(html);
        page.links = getRelativeAnchors(html);
        traversed[url] = page;

        var asyncFuncs = [];
        page.links.forEach(function (link) {
            var fullPath = urlUtil.resolve(domain, link.url);
            var existingLink = traversed[fullPath];
            if (existingLink) return Object.assign(link, {url: fullPath, title: existingLink.title});            
            asyncFuncs.push(function (next) {
                traversePage(fullPath, link, next);
            });
        });
        async.series(asyncFuncs, cb);
    });
}

function getRelativeAnchors(html) {
    var links = [], match;
    while (match = linkPattern.exec(html)) {
        var urlObj = urlUtil.parse(match[1]);
        if (isRelativePath(urlObj)) links.push({ url: urlObj.path });
    }
    return links;
}

function isRelativePath(urlObj) {
    return urlObj.path 
            && urlObj.path != '/'
            && urlObj.path.indexOf('/') === 0 
            && (!urlObj.host || urlObj.host == domainObj.host);
}

function getTitle(html) {
    var titleMatch = titlePattern.exec(html);
    return titleMatch && titleMatch[1];
}

traversePage(domain, sitemap, function () {
    if (verbose) console.log('\n\nFINAL SITEMAP:\n');
    console.log(JSON.stringify(sitemap, null, verbose ? 2 : 0));
});
