using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace RLRoll
{
    // RL Roll's launcher: starts the bundled Node server hidden, opens the
    // roller in the default browser, and sits in the tray so there's a clean
    // way to quit. No window, no console flash. Double-click and roll.
    internal static class Program
    {
        private const int Port = 8343;
        private static Process _node;
        private static NotifyIcon _tray;
        private static string _dir;

        [STAThread]
        private static int Main()
        {
            using (new Mutex(true, "Local\\RL-Roll", out bool mine))
            {
                // Second launch = the user wants the page again, not a second server.
                if (!mine) { OpenBrowser(); return 0; }
                try { Run(); }
                catch (Exception ex)
                {
                    MessageBox.Show("RL Roll could not start:\n\n" + ex.Message,
                        "RL Roll", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }
            }
            return 0;
        }

        private static void Run()
        {
            _dir = AppDomain.CurrentDomain.BaseDirectory;
            StartServer();

            // Give the server a moment, then open the page (it retries fine anyway).
            for (int i = 0; i < 60 && !PortOpen(); i++) Thread.Sleep(250);
            OpenBrowser();

            BuildTray();
            Application.Run();
            _tray.Visible = false;
            _tray.Dispose();
            StopServer();
        }

        private static void StartServer()
        {
            if (PortOpen()) return;                    // something already serves the roller
            string node = Path.Combine(_dir, "node", "node.exe");
            string script = Path.Combine(_dir, "bin", "serve.mjs");
            if (!File.Exists(node) || !File.Exists(script))
                throw new Exception("node\\node.exe or bin\\serve.mjs missing next to RLRoll.exe — unpack the whole zip.");
            _node = Process.Start(new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + script + "\"",
                WorkingDirectory = _dir,
                UseShellExecute = false,
                CreateNoWindow = true
            });
        }

        private static void StopServer()
        {
            try { if (_node != null && !_node.HasExited) _node.Kill(); }
            catch { }
        }

        private static bool PortOpen()
        {
            try
            {
                using (var c = new TcpClient())
                {
                    var t = c.BeginConnect("127.0.0.1", Port, null, null);
                    if (!t.AsyncWaitHandle.WaitOne(250)) return false;
                    c.EndConnect(t);
                    return true;
                }
            }
            catch { return false; }
        }

        private static void OpenBrowser()
        {
            try { Process.Start(new ProcessStartInfo { FileName = "http://127.0.0.1:" + Port + "/", UseShellExecute = true }); }
            catch { }
        }

        private static void BuildTray()
        {
            _tray = new NotifyIcon { Visible = true, Text = "RL Roll — training pack randomizer" };
            string ico = Path.Combine(_dir, "icon.ico");
            try { _tray.Icon = File.Exists(ico) ? new System.Drawing.Icon(ico) : System.Drawing.SystemIcons.Application; }
            catch { _tray.Icon = System.Drawing.SystemIcons.Application; }

            var menu = new ContextMenuStrip();
            menu.Items.Add("Open the roller", null, (s, e) => OpenBrowser());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Quit", null, (s, e) => Application.Exit());
            _tray.ContextMenuStrip = menu;
            _tray.DoubleClick += (s, e) => OpenBrowser();
        }
    }
}
